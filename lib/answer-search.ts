import type { SemanticSearchResult } from "@/lib/semantic-search";
import { answerWithGroq } from "@/lib/groq";

type AnswerSearchInput = {
  query: string;
  results: SemanticSearchResult[];
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

export function isAnswerServiceError(message: string) {
  return [
    "Answer",
    "Ollama",
    "Groq",
    "fetch failed",
    "ECONNREFUSED",
    "UND_ERR_CONNECT_TIMEOUT"
  ].some((token) => message.includes(token));
}

function sourceLabel(result: SemanticSearchResult, index: number) {
  const team = result.teamName ? `, ${result.teamName}` : "";
  const organization = result.organizationName
    ? `, ${result.organizationName}`
    : "";

  return `[${index + 1}] ${result.meetingTitle}${team}${organization}`;
}

function buildContext(results: SemanticSearchResult[]) {
  return results
    .map(
      (result, index) =>
        [
          sourceLabel(result, index),
          `Type: ${result.chunkType}`,
          `Date: ${result.meetingCreatedAt.toISOString().slice(0, 10)}`,
          `Content: ${result.content}`
        ].join("\n")
    )
    .join("\n\n");
}

function buildExtractiveAnswer({ query, results }: AnswerSearchInput) {
  if (results.length === 0) {
    return "I could not find relevant meeting notes for that question.";
  }

  const topResults = results.slice(0, 4);
  const lines = topResults.map(
    (result, index) => `${index + 1}. ${result.content}`
  );

  return [
    `Based on the closest meeting notes for "${query}":`,
    ...lines
  ].join("\n");
}

export async function answerFromMeetingChunks(input: AnswerSearchInput) {
  if (input.results.length === 0) {
    return buildExtractiveAnswer(input);
  }

  if (process.env.AI_PROVIDER !== "ollama") {
    if (process.env.AI_PROVIDER === "groq") {
      return answerWithGroq(input.query, buildContext(input.results));
    }

    return buildExtractiveAnswer(input);
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: [
            "You answer questions about meeting history using only the provided source notes.",
            "Do not invent facts. If the sources are not enough, say what is missing.",
            "Write a concise executive answer in plain text.",
            "Mention source numbers like [1] or [2] where useful."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `Question: ${input.query}`,
            "",
            "Source notes:",
            buildContext(input.results)
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(
      `Answer model returned status ${response.status}. Check that Ollama is running and the chat model is available.`
    );
  }

  const payload = (await response.json()) as OllamaResponse;
  const answer = payload.message?.content?.trim();

  if (!answer) {
    throw new Error(
      "The answer model returned an empty response. Try again with a more specific question."
    );
  }

  return answer;
}
