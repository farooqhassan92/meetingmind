import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildAccessibleMeetingWhere,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { searchMeetingChunks } from "@/lib/semantic-search";

const requestSchema = z.object({
  from: z.string().optional(),
  limit: z.number().int().min(1).max(25).optional(),
  organizationId: z.string().optional(),
  query: z.string().trim().min(3),
  teamId: z.string().optional(),
  to: z.string().optional()
});

function parseDate(value: string | undefined, boundary: "start" | "end") {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (boundary === "end") {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = requestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "Search query must be at least 3 characters." },
      { status: 400 }
    );
  }

  const access = await getUserMeetingAccess(userId);

  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const selectedOrganization = body.data.organizationId
    ? access.organizations.find(
        (organization) => organization.id === body.data.organizationId
      )
    : null;
  const teams = selectedOrganization
    ? selectedOrganization.teams.filter((team) => !team.archivedAt)
    : access.organizations
        .flatMap((organization) => organization.teams)
        .filter((team) => !team.archivedAt);
  const selectedTeam = body.data.teamId
    ? teams.find((team) => team.id === body.data.teamId)
    : null;
  const selectedOrganizationId = selectedOrganization?.id;
  const selectedTeamId = selectedTeam?.id;
  const accessibleWhere = buildAccessibleMeetingWhere(access, {
    organizationId: selectedOrganizationId,
    teamId: selectedTeamId
  });

  if ("id" in accessibleWhere && accessibleWhere.id === "__no_access__") {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchMeetingChunks(
      body.data.query,
      {
        accessibleOrganizationIds: access.ceoOrganizationIds,
        accessibleTeamIds: access.teamIds,
        from: parseDate(body.data.from, "start"),
        organizationId: selectedOrganizationId,
        teamId: selectedTeamId,
        to: parseDate(body.data.to, "end")
      },
      body.data.limit ?? 10
    );

    return NextResponse.json({ results });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Semantic search failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
