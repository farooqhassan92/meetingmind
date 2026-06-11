-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MeetingChunkType" AS ENUM (
    'SUMMARY',
    'TRANSCRIPT',
    'ACTION_ITEM',
    'DECISION',
    'TOPIC',
    'FOLLOW_UP_QUESTION'
);

-- CreateTable
CREATE TABLE "MeetingChunk" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "organizationId" TEXT,
    "teamId" TEXT,
    "type" "MeetingChunkType" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingChunk_meetingId_idx" ON "MeetingChunk"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingChunk_organizationId_idx" ON "MeetingChunk"("organizationId");

-- CreateIndex
CREATE INDEX "MeetingChunk_teamId_idx" ON "MeetingChunk"("teamId");

-- CreateIndex
CREATE INDEX "MeetingChunk_embedding_idx" ON "MeetingChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey
ALTER TABLE "MeetingChunk" ADD CONSTRAINT "MeetingChunk_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
