import {
  analysisSystemPrompt,
  meetingAnalysisSchema,
  type MeetingAnalysis
} from "./schemas";
import {
  analyzeTranscriptWithDemoProvider,
  buildSummary,
  findDecisions,
  sentencesFromTranscript
} from "./demo-analysis";

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanText(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (typeof parsed === "string") {
      return cleanText(parsed);
    }

    if (Array.isArray(parsed)) {
      return parsed.map((item) => cleanText(String(item))).join("; ");
    }

    const record = asRecord(parsed);
    const text =
      record.content ??
      record.value ??
      record.decision ??
      record.commitment ??
      record.question ??
      record.title ??
      record.description ??
      record.summary ??
      record.text;

    return typeof text === "string" && text.trim() ? cleanText(text) : trimmed;
  } catch {
    return trimmed;
  }
}

function asCleanString(value: unknown, fallback = "") {
  return cleanText(asString(value, fallback));
}

function asCleanNullableString(value: unknown) {
  const text = asNullableString(value);

  return text ? cleanText(text) : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function stringifyListItem(value: unknown) {
  if (typeof value === "string") {
    return cleanText(value);
  }

  const record = asRecord(value);
  return asCleanString(
    record.content ??
      record.value ??
      record.decision ??
      record.commitment ??
      record.question ??
      record.title ??
      record.description ??
      record.summary,
    JSON.stringify(value)
  );
}

function stringifyDecision(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const record = asRecord(value);
  const type = asString(
    record.decisionType ?? record.type ?? record.category,
    ""
  );
  const decision = stringifyListItem(value);

  if (type && decision && decision !== type) {
    return `${type}: ${decision}`;
  }

  return decision;
}

function titleWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function sentenceMatchesAction(sentence: string, title: string) {
  const lowerSentence = sentence.toLowerCase();
  const words = titleWords(title);

  if (words.length === 0) {
    return false;
  }

  const matchedWords = words.filter((word) => lowerSentence.includes(word));
  return matchedWords.length >= Math.min(3, words.length);
}

function extractAssigneeFromSentence(sentence: string) {
  const patterns = [
    /\b([A-Z][a-z]+)\s*,?\s+(?:please|can you|could you|will|should|needs to|need to)\b/,
    /\b([A-Z][a-z]+)\s*:\s*(?:I\s+will|I'll|I\s+can|I\s+will also)\b/i,
    /\b([A-Z][a-z]+)\s+(?:said|says)\s+(?:I\s+will|I'll|I\s+can|I\s+will also)\b/i,
    /\b(?:please|can you|could you)\b.*?\b([A-Z][a-z]+)\b/
  ];

  for (const pattern of patterns) {
    const match = sentence.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function inferAssignee(title: string, sentences: string[]) {
  const matchingSentence = sentences.find((sentence) =>
    sentenceMatchesAction(sentence, title)
  );

  if (!matchingSentence) {
    return null;
  }

  return extractAssigneeFromSentence(matchingSentence);
}

function withInferredAssignees(
  actionItems: MeetingAnalysis["actionItems"],
  sentences: string[]
) {
  return actionItems.map((item) => ({
    ...item,
    assignee: item.assignee ?? inferAssignee(item.title, sentences)
  }));
}

export function normalizeMeetingAnalysis(
  value: unknown,
  transcript: string
): MeetingAnalysis {
  const record = asRecord(value);
  const fallback = analyzeTranscriptWithDemoProvider(transcript);
  const sentences = sentencesFromTranscript(transcript);

  const actionItems = asArray(record.actionItems).map((item) => {
    const itemRecord = asRecord(item);
    const title = asCleanString(
      itemRecord.title ?? itemRecord.task ?? itemRecord.action,
      stringifyListItem(item)
    );

    return {
      title,
      assignee:
        asCleanNullableString(itemRecord.assignee ?? itemRecord.owner) ??
        inferAssignee(title, sentences),
      deadline: asCleanNullableString(
        itemRecord.deadline ?? itemRecord.dueDate ?? itemRecord.due
      )
    };
  });

  const topics = asArray(record.topics).map((topic) => {
    const topicRecord = asRecord(topic);

    return {
      title: asCleanString(
        topicRecord.title ?? topicRecord.name ?? topicRecord.topic,
        stringifyListItem(topic)
      ),
      notes: asCleanNullableString(
        topicRecord.notes ?? topicRecord.summary ?? topicRecord.description
      )
    };
  });

  const normalized = meetingAnalysisSchema.parse({
    title: asCleanString(record.title, "Meeting notes"),
    summary: asCleanString(record.summary, "No summary returned."),
    actionItems,
    decisions: asArray(record.decisions).map(stringifyDecision),
    topics,
    followUpQuestions: asArray(record.followUpQuestions).map(stringifyListItem)
  });

  return {
    title: normalized.title,
    summary:
      normalized.summary === "No summary returned."
        ? fallback.summary
        : normalized.summary,
    actionItems: withInferredAssignees(
      normalized.actionItems.length > 0
        ? normalized.actionItems
        : fallback.actionItems,
      sentences
    ),
    decisions:
      normalized.decisions.length > 0
        ? normalized.decisions
        : findDecisions(sentences),
    topics:
      normalized.topics.length > 0
        ? normalized.topics
        : [
            {
              title: "Main discussion",
              notes: buildSummary(sentences)
            }
          ],
    followUpQuestions:
      normalized.followUpQuestions.length > 0
        ? normalized.followUpQuestions
        : fallback.followUpQuestions
  };
}

export async function analyzeTranscriptWithOllama(
  transcript: string
): Promise<MeetingAnalysis> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2:3b";

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content: [
            analysisSystemPrompt,
            "The transcript may be generated by speech-to-text and may have weak punctuation, no speaker labels, repeated words, or imperfect sentence boundaries.",
            "Infer structure from conversational intent, but do not invent facts.",
            "Always identify 1-5 topics when the transcript has meaningful content.",
            "For decisions, include firm commitments, agreements, approvals, launch dates, selected plans, and settled next steps, even when the word decided is not used.",
            "For actionItems, include tasks expressed with will, need to, please, can you, I will, or we should.",
            "Return strict JSON with title, summary, actionItems, decisions, topics, and followUpQuestions."
          ].join(" ")
        },
        { role: "user", content: transcript }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OllamaResponse;
  const content = payload.message?.content;

  if (!content) {
    throw new Error("Ollama returned an empty analysis response.");
  }

  return normalizeMeetingAnalysis(JSON.parse(content), transcript);
}
