import type { MeetingAnalysis } from "./schemas";

const actionVerbs = [
  "follow up",
  "send",
  "prepare",
  "schedule",
  "review",
  "create",
  "update",
  "share",
  "confirm",
  "finish"
];

export function sentencesFromTranscript(transcript: string) {
  return transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .map((sentence) => sentence.replace(/\s+/g, " "))
    .filter(Boolean);
}

export function pickTitle(sentences: string[]) {
  const first = sentences[0] ?? "Meeting notes";
  return first.length > 70 ? `${first.slice(0, 67)}...` : first;
}

export function buildSummary(sentences: string[]) {
  return sentences.slice(0, 3).join(" ") || "No transcript content provided.";
}

export function findActionItems(sentences: string[]) {
  return sentences
    .filter((sentence) =>
      actionVerbs.some((verb) => sentence.toLowerCase().includes(verb))
    )
    .slice(0, 5)
    .map((sentence) => ({
      title: sentence,
      assignee: null,
      deadline: null
    }));
}

export function findDecisions(sentences: string[]) {
  return sentences
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return (
        lower.includes("decision") ||
        lower.includes("decided") ||
        lower.includes("agreed") ||
        lower.includes("approved") ||
        lower.includes("confirmed") ||
        lower.includes("settled") ||
        lower.includes("selected") ||
        lower.includes("chosen") ||
        lower.includes("committed") ||
        lower.includes("we will") ||
        lower.includes("we are going to") ||
        lower.includes("we're going to") ||
        lower.includes("we should go with") ||
        lower.includes("we'll go with") ||
        lower.includes("the plan is") ||
        lower.includes("launch date") ||
        lower.includes("launch will") ||
        lower.includes("include in launch") ||
        lower.includes("add short onboarding") ||
        lower.includes("stays scheduled") ||
        lower.includes("will stay scheduled") ||
        /\b(?:launch|release|rollout)\b.*\b(?:next|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2})\b/.test(
          lower
        ) ||
        /\b(?:we|let's|lets)\s+(?:add|include|ship|launch|keep|move|use)\b/.test(
          lower
        )
      );
    })
    .slice(0, 5);
}

export function findQuestions(sentences: string[]) {
  const directQuestions = sentences.filter((sentence) => sentence.endsWith("?"));

  if (directQuestions.length > 0) {
    return directQuestions.slice(0, 5);
  }

  const followUpSentence = sentences.find((sentence) =>
    sentence.toLowerCase().includes("follow-up questions included")
  );

  if (!followUpSentence) {
    return [];
  }

  return followUpSentence
    .replace(/^.*follow-up questions included\s*/i, "")
    .split(/,\s*and\s*|,\s*|\s+and\s+/)
    .map((question) => question.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .map((question) =>
      question.endsWith("?") ? question : `${question}?`
    )
    .slice(0, 5);
}

export function analyzeTranscriptWithDemoProvider(
  transcript: string
): MeetingAnalysis {
  const sentences = sentencesFromTranscript(transcript);

  return {
    title: pickTitle(sentences),
    summary: buildSummary(sentences),
    actionItems: findActionItems(sentences),
    decisions: findDecisions(sentences),
    topics: [
      {
        title: "Main discussion",
        notes: buildSummary(sentences)
      }
    ],
    followUpQuestions: findQuestions(sentences)
  };
}
