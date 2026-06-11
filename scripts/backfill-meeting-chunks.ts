import { createMeetingChunks } from "@/lib/meeting-chunks";
import { prisma } from "@/lib/prisma";
import type { MeetingAnalysis } from "@/mcp-server/src/llm/schemas";

function analysisFromMeeting(
  meeting: Awaited<ReturnType<typeof getMeetingsWithoutChunks>>[number]
): MeetingAnalysis {
  return {
    title: meeting.title,
    summary: meeting.summary,
    actionItems: meeting.actionItems.map((item) => ({
      title: item.title,
      assignee: item.assignee,
      deadline: item.deadline
    })),
    decisions: meeting.decisions.map((decision) => decision.content),
    topics: meeting.topics.map((topic) => ({
      title: topic.title,
      notes: topic.notes
    })),
    followUpQuestions: meeting.followUpQuestions.map(
      (followUp) => followUp.question
    )
  };
}

function getMeetingsWithoutChunks() {
  return prisma.meeting.findMany({
    where: {
      chunks: {
        none: {}
      }
    },
    include: {
      actionItems: true,
      decisions: true,
      topics: true,
      followUpQuestions: true
    },
    orderBy: { createdAt: "asc" }
  });
}

async function main() {
  const meetings = await getMeetingsWithoutChunks();

  console.log(`Found ${meetings.length} meetings without chunks.`);

  for (const meeting of meetings) {
    console.log(`Creating chunks for ${meeting.id} - ${meeting.title}`);

    await createMeetingChunks({
      analysis: analysisFromMeeting(meeting),
      meetingId: meeting.id,
      organizationId: meeting.organizationId,
      teamId: meeting.teamId,
      transcript: meeting.transcript
    });
  }

  console.log("Meeting chunk backfill complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
