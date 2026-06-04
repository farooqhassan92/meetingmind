import { z } from "zod";

import { analyzeTranscriptWithDemoProvider } from "../llm/demo-analysis";
import { analyzeTranscriptWithOllama } from "../llm/ollama";

export const analyzeMeetingInputSchema = z.object({
  transcript: z.string().min(20)
});

export async function analyzeMeetingTool(
  input: z.infer<typeof analyzeMeetingInputSchema>
) {
  if (process.env.AI_PROVIDER === "ollama") {
    return analyzeTranscriptWithOllama(input.transcript);
  }

  return analyzeTranscriptWithDemoProvider(input.transcript);
}
