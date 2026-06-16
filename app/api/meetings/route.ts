import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  buildMeetingFilterWhere,
  getDateFilter,
  MEETING_HISTORY_PAGE_SIZE,
  type MeetingHistoryCard
} from "@/lib/meeting-history";
import {
  buildAccessibleMeetingWhere,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

function toMeetingCard(
  meeting: Awaited<ReturnType<typeof getMeetingsPage>>[number],
  canDelete: boolean
): MeetingHistoryCard {
  return {
    actionItemCount: meeting._count.actionItems,
    canDelete,
    createdAt: meeting.createdAt.toISOString(),
    decisionCount: meeting._count.decisions,
    id: meeting.id,
    organizationName: meeting.organization?.name ?? null,
    summary: meeting.summary,
    teamName: meeting.team?.name ?? null,
    title: meeting.title
  };
}

function getMeetingsPage({
  cursor,
  take,
  where
}: {
  cursor?: string;
  take: number;
  where: Prisma.MeetingWhereInput;
}) {
  return prisma.meeting.findMany({
    where,
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      organizationId: true,
      summary: true,
      title: true,
      userId: true,
      organization: {
        select: { name: true }
      },
      team: {
        select: { name: true }
      },
      _count: {
        select: { actionItems: true, decisions: true }
      }
    }
  });
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getUserMeetingAccess(userId);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || MEETING_HISTORY_PAGE_SIZE, 1),
    MEETING_HISTORY_PAGE_SIZE
  );
  const query = url.searchParams.get("query")?.trim() ?? "";
  const range = url.searchParams.get("range") ?? "all";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const requestedOrganizationId =
    url.searchParams.get("organizationId") ?? undefined;
  const requestedTeamId = url.searchParams.get("teamId") ?? undefined;
  const organizations = access.organizations;
  const selectedOrganization = requestedOrganizationId
    ? organizations.find(
        (organization) => organization.id === requestedOrganizationId
      )
    : null;
  const teams = selectedOrganization
    ? selectedOrganization.teams.filter((team) => !team.archivedAt)
    : organizations
        .flatMap((organization) => organization.teams)
        .filter((team) => !team.archivedAt);
  const selectedTeam = requestedTeamId
    ? teams.find((team) => team.id === requestedTeamId)
    : null;
  const selectedOrganizationId = selectedOrganization?.id;
  const selectedTeamId = selectedTeam?.id;
  const accessibleWhere = buildAccessibleMeetingWhere(access, {
    organizationId: selectedOrganizationId,
    teamId: selectedTeamId
  });
  const filterWhere = buildMeetingFilterWhere({
    dateFilter: getDateFilter(range, from, to),
    query
  });
  const meetings = await getMeetingsPage({
    cursor,
    take: limit + 1,
    where: {
      AND: [accessibleWhere, filterWhere]
    }
  });
  const hasMore = meetings.length > limit;
  const visibleMeetings = hasMore ? meetings.slice(0, limit) : meetings;
  const cards = visibleMeetings.map((meeting) =>
    toMeetingCard(
      meeting,
      meeting.userId === access.user.id ||
        Boolean(
          meeting.organizationId &&
            access.orgWideOrganizationIds.includes(meeting.organizationId)
        )
    )
  );

  return NextResponse.json({
    meetings: cards,
    nextCursor: hasMore ? cards.at(-1)?.id ?? null : null
  });
}
