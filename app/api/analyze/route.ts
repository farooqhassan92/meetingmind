import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeMeeting } from "@/lib/mcp-client";
import { createMeetingChunks } from "@/lib/meeting-chunks";
import {
  ensureAppUser,
  getCreatableTeams,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  organizationId: z.string().optional(),
  teamId: z.string().optional(),
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
    const appUser = await ensureAppUser({
      clerkId: clerkUserId,
      email: userEmail,
      name: userName
    });
    const access = await getUserMeetingAccess(clerkUserId);

    if (!access) {
      return NextResponse.json(
        { error: "Could not load workspace access." },
        { status: 500 }
      );
    }

    if (access.memberships.length === 0) {
      return NextResponse.json(
        { error: "Create or join an organization before saving meetings." },
        { status: 403 }
      );
    }

    const creatableTeams = getCreatableTeams(access);
    const organization = body.data.organizationId
      ? access.organizations.find(
          (candidate) => candidate.id === body.data.organizationId
        )
      : access.organizations[0];

    if (!organization) {
      return NextResponse.json(
        { error: "You do not have access to the selected organization." },
        { status: 403 }
      );
    }

    const team =
      body.data.teamId
        ? creatableTeams.find(
            (candidate) => candidate.id === body.data.teamId
          )
        : creatableTeams.find(
            (candidate) => candidate.organizationId === organization.id
          );

    if (!team || team.organizationId !== organization.id) {
      return NextResponse.json(
        { error: "You cannot create meetings for the selected team." },
        { status: 400 }
      );
    }

    meeting = await prisma.meeting.create({
      data: {
        userId: appUser.id,
        organizationId: organization.id,
        teamId: team.id,
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

    try {
      await createMeetingChunks({
        analysis,
        meetingId: meeting.id,
        organizationId: organization.id,
        teamId: team.id,
        transcript: body.data.transcript
      });
    } catch (caught) {
      console.error("Could not create meeting search chunks.", caught);
    }
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Could not save meeting.";

    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ analysis, meetingId: meeting.id });
}
