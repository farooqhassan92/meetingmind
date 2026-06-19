import type { Meeting } from "@prisma/client";

import type { getUserMeetingAccess } from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

type MeetingScope = Pick<Meeting, "organizationId" | "teamId" | "userId">;
type Access = NonNullable<Awaited<ReturnType<typeof getUserMeetingAccess>>>;

export function canManageMeetingActionItems(
  access: Access,
  meeting: MeetingScope
) {
  return Boolean(
    meeting.userId === access.user.id ||
      (meeting.organizationId &&
        access.orgWideOrganizationIds.includes(meeting.organizationId)) ||
      (meeting.teamId && access.managedTeamIds.includes(meeting.teamId))
  );
}

export async function getActionItemAssigneesForMeeting(meeting: MeetingScope) {
  if (!meeting.organizationId && !meeting.teamId) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      OR: [
        ...(meeting.organizationId
          ? [
              {
                memberships: {
                  some: {
                    organizationId: meeting.organizationId
                  }
                }
              }
            ]
          : []),
        ...(meeting.teamId
          ? [
              {
                teamMemberships: {
                  some: {
                    teamId: meeting.teamId
                  }
                }
              }
            ]
          : [])
      ]
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      email: true,
      id: true,
      name: true
    }
  });
}

export async function getActionItemAssigneesForAccess(access: Access) {
  const organizationIds = access.memberships.map(
    (membership) => membership.organizationId
  );
  const teamIds = access.teamIds;

  if (organizationIds.length === 0 && teamIds.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      OR: [
        ...(organizationIds.length > 0
          ? [
              {
                memberships: {
                  some: {
                    organizationId: { in: organizationIds }
                  }
                }
              }
            ]
          : []),
        ...(teamIds.length > 0
          ? [
              {
                teamMemberships: {
                  some: {
                    teamId: { in: teamIds }
                  }
                }
              }
            ]
          : [])
      ]
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      email: true,
      id: true,
      name: true
    }
  });
}
