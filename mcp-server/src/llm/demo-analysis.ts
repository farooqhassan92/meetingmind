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

function sentencesFromTranscript(transcript: string) {
  return transcript
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickTitle(sentences: string[]) {
  const first = sentences[0] ?? "Meeting notes";
  return first.length > 70 ? `${first.slice(0, 67)}...` : first;
}

function buildSummary(sentences: string[]) {
  return sentences.slice(0, 3).join(" ") || "No transcript content provided.";
}

function findActionItems(sentences: string[]) {
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

function findDecisions(sentences: string[]) {
  return sentences
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      return (
        lower.includes("decided") ||
        lower.includes("agreed") ||
        lower.includes("approved")
      );
    })
    .slice(0, 5);
}

function findQuestions(sentences: string[]) {
  return sentences
    .filter((sentence) => sentence.endsWith("?"))
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
