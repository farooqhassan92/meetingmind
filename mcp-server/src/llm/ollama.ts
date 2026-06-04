import {
  analysisSystemPrompt,
  meetingAnalysisSchema,
  type MeetingAnalysis
} from "./schemas";

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

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
          content: `${analysisSystemPrompt} Return strict JSON with title, summary, actionItems, decisions, topics, and followUpQuestions.`
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

  return meetingAnalysisSchema.parse(JSON.parse(content));
}
