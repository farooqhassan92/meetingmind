import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  answerFromMeetingChunks,
  isAnswerServiceError
} from "@/lib/answer-search";
import { isEmbeddingServiceError } from "@/lib/embeddings";
import {
  buildAccessibleMeetingWhere,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { searchMeetingChunks } from "@/lib/semantic-search";

const requestSchema = z.object({
  from: z.string().optional(),
  limit: z.number().int().min(1).max(12).optional(),
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
      { error: "Question must be at least 3 characters." },
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
    return NextResponse.json({
      answer: "I could not find relevant meeting notes for that question.",
      sources: []
    });
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
      body.data.limit ?? 8
    );
    const answer = await answerFromMeetingChunks({
      query: body.data.query,
      results
    });

    return NextResponse.json({
      answer,
      sources: results
    });
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : "";
    const message =
      isEmbeddingServiceError(detail)
        ? "Could not search meeting notes for this answer. Check that Ollama is running and nomic-embed-text is available, then try again."
        : isAnswerServiceError(detail)
          ? "Could not generate an answer. Check that Ollama is running and the chat model is available, then try again."
          : detail || "Could not generate an answer. Please try again.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
