import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeMeeting } from "@/lib/mcp-client";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  transcript: z.string().min(20)
});

export async function POST(request: Request) {
  const hasClerkConfig = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );
  let clerkUserId: string | null = null;
  let userEmail: string | null = null;
  let userName: string | null = null;

  if (hasClerkConfig) {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    clerkUserId = userId;
    userEmail = user?.primaryEmailAddress?.emailAddress ?? null;
    userName = user?.fullName ?? user?.username ?? null;

    if (!userEmail) {
      return NextResponse.json(
        { error: "Signed-in user is missing a primary email address." },
        { status: 500 }
      );
    }
  }

  const body = requestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "Transcript must be at least 20 characters." },
      { status: 400 }
    );
  }

  let analysis;

  try {
    analysis = await analyzeMeeting(body.data.transcript);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Meeting analysis failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!clerkUserId || !userEmail) {
    return NextResponse.json({ analysis });
  }

  let meeting;

  try {
    const appUser = await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      update: {
        email: userEmail,
        name: userName
      },
      create: {
        clerkId: clerkUserId,
        email: userEmail,
        name: userName
      }
    });

    meeting = await prisma.meeting.create({
      data: {
        userId: appUser.id,
        title: analysis.title,
        transcript: body.data.transcript,
        summary: analysis.summary,
        actionItems: {
          create: analysis.actionItems.map((item) => ({
            title: item.title,
            assignee: item.assignee,
            deadline: item.deadline
          }))
        },
        decisions: {
          create: analysis.decisions.map((decision) => ({
            content: decision
          }))
        },
        topics: {
          create: analysis.topics.map((topic) => ({
            title: topic.title,
            notes: topic.notes
          }))
        },
        followUpQuestions: {
          create: analysis.followUpQuestions.map((question) => ({
            question
          }))
        }
      }
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Could not save meeting.";

    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ analysis, meetingId: meeting.id });
}
