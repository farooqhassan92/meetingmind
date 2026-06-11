import { Prisma } from "@prisma/client";

import { embedText, toVectorLiteral } from "@/lib/embeddings";
import { prisma } from "@/lib/prisma";

export type SemanticSearchFilters = {
  accessibleOrganizationIds: string[];
  accessibleTeamIds: string[];
  from?: Date;
  organizationId?: string;
  teamId?: string;
  to?: Date;
};

export type SemanticSearchResult = {
  chunkId: string;
  chunkType: string;
  content: string;
  createdAt: Date;
  distance: number;
  meetingCreatedAt: Date;
  meetingId: string;
  meetingSummary: string;
  meetingTitle: string;
  organizationId: string | null;
  organizationName: string | null;
  teamId: string | null;
  teamName: string | null;
};

function buildDateFilter(from?: Date, to?: Date) {
  const filters: Prisma.Sql[] = [];

  if (from) {
    filters.push(Prisma.sql`m."createdAt" >= ${from}`);
  }

  if (to) {
    filters.push(Prisma.sql`m."createdAt" <= ${to}`);
  }

  return filters;
}

export async function searchMeetingChunks(
  query: string,
  filters: SemanticSearchFilters,
  limit = 10
) {
  const queryEmbedding = toVectorLiteral(await embedText(query));
  const accessibleOrganizationIds = filters.organizationId
    ? filters.accessibleOrganizationIds.filter(
        (id) => id === filters.organizationId
      )
    : filters.accessibleOrganizationIds;
  const accessibleTeamIds = filters.teamId
    ? filters.accessibleTeamIds.filter((id) => id === filters.teamId)
    : filters.accessibleTeamIds;
  const accessParts: Prisma.Sql[] = [];

  if (accessibleOrganizationIds.length > 0) {
    accessParts.push(
      Prisma.sql`c."organizationId" IN (${Prisma.join(accessibleOrganizationIds)})`
    );
  }

  if (accessibleTeamIds.length > 0) {
    accessParts.push(
      Prisma.sql`c."teamId" IN (${Prisma.join(accessibleTeamIds)})`
    );
  }

  if (
    accessibleOrganizationIds.length === 0 &&
    accessibleTeamIds.length === 0
  ) {
    return [];
  }

  const whereParts: Prisma.Sql[] = [
    Prisma.sql`(${Prisma.join(accessParts, " OR ")})`,
    ...buildDateFilter(filters.from, filters.to)
  ];

  if (filters.organizationId) {
    whereParts.push(Prisma.sql`c."organizationId" = ${filters.organizationId}`);
  }

  if (filters.teamId) {
    whereParts.push(Prisma.sql`c."teamId" = ${filters.teamId}`);
  }

  return prisma.$queryRaw<SemanticSearchResult[]>`
    SELECT
      c."id" AS "chunkId",
      c."type"::text AS "chunkType",
      c."content",
      c."createdAt",
      c."embedding" <=> ${queryEmbedding}::vector AS "distance",
      m."id" AS "meetingId",
      m."title" AS "meetingTitle",
      m."summary" AS "meetingSummary",
      m."createdAt" AS "meetingCreatedAt",
      o."id" AS "organizationId",
      o."name" AS "organizationName",
      t."id" AS "teamId",
      t."name" AS "teamName"
    FROM "MeetingChunk" c
    INNER JOIN "Meeting" m ON m."id" = c."meetingId"
    LEFT JOIN "Organization" o ON o."id" = c."organizationId"
    LEFT JOIN "Team" t ON t."id" = c."teamId"
    WHERE ${Prisma.join(whereParts, " AND ")}
    ORDER BY "distance" ASC
    LIMIT ${limit}
  `;
}
