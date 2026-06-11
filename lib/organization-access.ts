import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const orgWideRoles = ["CEO"] as const;

type AppUserInput = {
  clerkId: string;
  email: string;
  name: string | null;
};

export async function ensureAppUser(input: AppUserInput) {
  return prisma.user.upsert({
    where: { clerkId: input.clerkId },
    update: {
      email: input.email,
      name: input.name
    },
    create: {
      clerkId: input.clerkId,
      email: input.email,
      name: input.name
    }
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function createOrganizationForUser(userId: string, name: string) {
  const baseSlug = slugify(name) || "organization";

  return prisma.organization.create({
    data: {
      name,
      slug: `${baseSlug}-${Date.now()}`,
      members: {
        create: {
          userId,
          role: "CEO"
        }
      },
      teams: {
        create: {
          name: "General"
        }
      }
    },
    include: {
      teams: true
    }
  });
}

export async function getUserMeetingAccess(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      memberships: {
        include: {
          organization: {
            include: {
              teams: {
                include: {
                  members: {
                    include: { user: true },
                    orderBy: { createdAt: "asc" }
                  }
                },
                orderBy: { name: "asc" }
              }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      teamMemberships: {
        include: {
          team: true
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!user) {
    return null;
  }

  const ceoOrganizationIds = user.memberships
    .filter((membership) => membership.role === "CEO")
    .map((membership) => membership.organizationId);
  const teamIds = user.teamMemberships.map(
    (membership) => membership.teamId
  );
  const managedTeamIds = user.teamMemberships
    .filter((membership) => membership.role === "MANAGER")
    .map((membership) => membership.teamId);

  return {
    user,
    memberships: user.memberships,
    teamMemberships: user.teamMemberships,
    organizations: user.memberships.map((membership) => membership.organization),
    ceoOrganizationIds,
    orgWideOrganizationIds: ceoOrganizationIds,
    teamIds,
    managedTeamIds
  };
}

type AccessibleMeetingOptions = {
  organizationId?: string;
  teamId?: string;
};

export function buildAccessibleMeetingWhere(
  access: NonNullable<Awaited<ReturnType<typeof getUserMeetingAccess>>>,
  options: AccessibleMeetingOptions = {}
): Prisma.MeetingWhereInput {
  const membershipOrganizationIds = access.memberships.map(
    (membership) => membership.organizationId
  );
  const canSearchSelectedOrganization =
    !options.organizationId ||
    membershipOrganizationIds.includes(options.organizationId);
  const selectedTeamBelongsToOrganization =
    !options.teamId ||
    access.organizations.some((organization) =>
      organization.teams.some(
        (team) =>
          team.id === options.teamId &&
          (!options.organizationId ||
            team.organizationId === options.organizationId)
      )
    );

  if (!canSearchSelectedOrganization || !selectedTeamBelongsToOrganization) {
    return { id: "__no_access__" };
  }

  const accessScopes: Prisma.MeetingWhereInput[] = [
    { organizationId: { in: access.ceoOrganizationIds } },
    { teamId: { in: access.teamIds } }
  ];

  return {
    AND: [
      {
        OR: accessScopes
      },
      ...(options.organizationId
        ? [{ organizationId: options.organizationId }]
        : []),
      ...(options.teamId ? [{ teamId: options.teamId }] : [])
    ]
  };
}

export function getCreatableTeams(
  access: NonNullable<Awaited<ReturnType<typeof getUserMeetingAccess>>>
) {
  const ceoTeams = access.organizations
    .filter((organization) =>
      access.ceoOrganizationIds.includes(organization.id)
    )
    .flatMap((organization) => organization.teams);
  const assignedTeams = access.teamMemberships.map(
    (membership) => membership.team
  );
  const teamsById = new Map(
    [...ceoTeams, ...assignedTeams].map((team) => [team.id, team])
  );

  return [...teamsById.values()];
}

export async function getPendingInvitationsForEmail(email: string) {
  return prisma.organizationInvitation.findMany({
    where: {
      email: {
        equals: email,
        mode: "insensitive"
      },
      acceptedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    include: {
      organization: true,
      team: true
    },
    orderBy: { createdAt: "desc" }
  });
}
