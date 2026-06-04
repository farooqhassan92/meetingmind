import { z } from "zod";

export const meetingAnalysisSchema = z.object({
  title: z.string(),
  summary: z.string(),
  actionItems: z.array(
    z.object({
      title: z.string(),
      assignee: z.string().nullable(),
      deadline: z.string().nullable()
    })
  ),
  decisions: z.array(z.string()),
  topics: z.array(
    z.object({
      title: z.string(),
      notes: z.string().nullable()
    })
  ),
  followUpQuestions: z.array(z.string())
});

export type MeetingAnalysis = z.infer<typeof meetingAnalysisSchema>;

export const meetingAnalysisJsonSchema = {
  name: "meeting_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "summary",
      "actionItems",
      "decisions",
      "topics",
      "followUpQuestions"
    ],
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      actionItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "assignee", "deadline"],
          properties: {
            title: { type: "string" },
            assignee: { type: ["string", "null"] },
            deadline: { type: ["string", "null"] }
          }
        }
      },
      decisions: {
        type: "array",
        items: { type: "string" }
      },
      topics: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "notes"],
          properties: {
            title: { type: "string" },
            notes: { type: ["string", "null"] }
          }
        }
      },
      followUpQuestions: {
        type: "array",
        items: { type: "string" }
      }
    }
  },
  strict: true
} as const;

export const analysisSystemPrompt = [
  "You extract structured meeting notes for a SaaS product called MeetingMind.",
  "Return only factual information supported by the transcript.",
  "Use null when an assignee, deadline, or topic note is not stated.",
  "Keep summaries concise and action item titles clear."
].join(" ");
