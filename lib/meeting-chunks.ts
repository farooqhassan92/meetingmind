import { randomUUID } from "node:crypto";

import { embedText, toVectorLiteral } from "@/lib/embeddings";
import { prisma } from "@/lib/prisma";
import type { MeetingAnalysis } from "@/mcp-server/src/llm/schemas";

type ChunkInput = {
  content: string;
  type:
    | "SUMMARY"
    | "TRANSCRIPT"
    | "ACTION_ITEM"
    | "DECISION"
    | "TOPIC"
    | "FOLLOW_UP_QUESTION";
};

type CreateMeetingChunksInput = {
  analysis: MeetingAnalysis;
  meetingId: string;
  organizationId: string | null;
  teamId: string | null;
  transcript: string;
};

type EmbeddedChunk = ChunkInput & {
  embedding: string;
  id: string;
};

const MAX_TRANSCRIPT_CHUNK_LENGTH = 1200;
const MAX_TRANSCRIPT_CHUNKS = 12;

function cleanContent(content: string) {
  return content.replace(/\s+/g, " ").trim();
}

function pushChunk(chunks: ChunkInput[], type: ChunkInput["type"], content: string) {
  const cleaned = cleanContent(content);

  if (cleaned) {
    chunks.push({ type, content: cleaned });
  }
}

function chunkTranscript(transcript: string) {
  const paragraphs = transcript
    .split(/\n{2,}|\r?\n/)
    .map(cleanContent)
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + " " + paragraph).trim().length > MAX_TRANSCRIPT_CHUNK_LENGTH) {
      if (current) {
        chunks.push(current);
      }

      current = paragraph;
    } else {
      current = `${current} ${paragraph}`.trim();
    }

    if (chunks.length >= MAX_TRANSCRIPT_CHUNKS) {
      break;
    }
  }

  if (current && chunks.length < MAX_TRANSCRIPT_CHUNKS) {
    chunks.push(current);
  }

  return chunks;
}

export function buildMeetingChunks(
  analysis: MeetingAnalysis,
  transcript: string
) {
  const chunks: ChunkInput[] = [];

  pushChunk(chunks, "SUMMARY", analysis.summary);

  for (const decision of analysis.decisions) {
    pushChunk(chunks, "DECISION", decision);
  }

  for (const item of analysis.actionItems) {
    pushChunk(
      chunks,
      "ACTION_ITEM",
      [
        item.title,
        item.assignee ? `Assignee: ${item.assignee}` : "",
        item.deadline ? `Deadline: ${item.deadline}` : ""
      ]
        .filter(Boolean)
        .join(". ")
    );
  }

  for (const topic of analysis.topics) {
    pushChunk(
      chunks,
      "TOPIC",
      [topic.title, topic.notes].filter(Boolean).join(": ")
    );
  }

  for (const question of analysis.followUpQuestions) {
    pushChunk(chunks, "FOLLOW_UP_QUESTION", question);
  }

  for (const transcriptChunk of chunkTranscript(transcript)) {
    pushChunk(chunks, "TRANSCRIPT", transcriptChunk);
  }

  return chunks;
}

export async function createMeetingChunks({
  analysis,
  meetingId,
  organizationId,
  teamId,
  transcript
}: CreateMeetingChunksInput) {
  const chunks = buildMeetingChunks(analysis, transcript);
  const embeddedChunks: EmbeddedChunk[] = [];

  for (const chunk of chunks) {
    embeddedChunks.push({
      ...chunk,
      embedding: toVectorLiteral(await embedText(chunk.content)),
      id: randomUUID()
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.meetingChunk.deleteMany({
      where: { meetingId }
    });

    for (const chunk of embeddedChunks) {
      await tx.$executeRaw`
        INSERT INTO "MeetingChunk" (
          "id",
          "meetingId",
          "organizationId",
          "teamId",
          "type",
          "content",
          "embedding",
          "createdAt"
        )
        VALUES (
          ${chunk.id},
          ${meetingId},
          ${organizationId},
          ${teamId},
          ${chunk.type}::"MeetingChunkType",
          ${chunk.content},
          ${chunk.embedding}::vector,
          NOW()
        )
      `;
    }
  });
}
