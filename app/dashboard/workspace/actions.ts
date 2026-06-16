"use server";

import { randomBytes } from "node:crypto";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createOrganizationForUser,
  ensureAppUser,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

const teamSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(80)
});

const teamArchiveSchema = z.object({
  teamId: z.string().min(1)
});

const memberSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().trim().email(),
  role: z.enum(["CEO", "MEMBER"])
});

const inviteSchema = z.object({
  organizationId: z.string().min(1),
  email: z.string().trim().email(),
  organizationRole: z.enum(["CEO", "MEMBER"]),
  teamId: z.string().optional(),
  teamRole: z.enum(["MANAGER", "MEMBER"]).optional()
});

const teamMemberSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["MANAGER", "MEMBER"])
});

const removeTeamMemberSchema = z.object({
  teamId: z.string().min(1),
  userId: z.string().min(1)
});

const updateOrganizationMemberSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["CEO", "MEMBER"])
});

const removeOrganizationMemberSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1)
});

const cancelInvitationSchema = z.object({
  invitationId: z.string().min(1),
  organizationId: z.string().min(1)
});

async function requireProfile() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in" as Route);
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;

  if (!email) {
    throw new Error("Signed-in user is missing a primary email address.");
  }

  return ensureAppUser({
    clerkId: userId,
    email,
    name: clerkUser.fullName ?? clerkUser.username ?? null
  });
}

async function requireAccess() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in" as Route);
  }

  await requireProfile();
  const access = await getUserMeetingAccess(userId);

  if (!access) {
    throw new Error("Could not load workspace access.");
  }

  return access;
}

function isCeo(
  access: NonNullable<Awaited<ReturnType<typeof getUserMeetingAccess>>>,
  organizationId: string
) {
  return access.ceoOrganizationIds.includes(organizationId);
}

function canManageTeam(
  access: NonNullable<Awaited<ReturnType<typeof getUserMeetingAccess>>>,
  teamId: string
) {
  const team = access.organizations
    .flatMap((organization) => organization.teams)
    .find((candidate) => candidate.id === teamId);

  return Boolean(
    team &&
      !team.archivedAt &&
      (isCeo(access, team.organizationId) ||
        access.managedTeamIds.includes(team.id))
  );
}

async function assertCanChangeOrganizationMember(
  organizationId: string,
  userId: string,
  nextRole?: "CEO" | "MEMBER"
) {
  const currentMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId
      }
    }
  });

  if (!currentMember) {
    throw new Error("Organization member not found.");
  }

  const ceoCount = await prisma.organizationMember.count({
    where: {
      organizationId,
      role: "CEO"
    }
  });
  const wouldRemoveCeo =
    currentMember.role === "CEO" && (!nextRole || nextRole !== "CEO");

  if (wouldRemoveCeo && ceoCount <= 1) {
    throw new Error("An organization must always have at least one CEO.");
  }
}

export async function createOrganizationAction(formData: FormData) {
  const user = await requireProfile();
  const parsed = organizationSchema.parse({
    name: formData.get("name")
  });
  const organization = await createOrganizationForUser(user.id, parsed.name);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
  revalidatePath("/onboarding");
  redirect(`/dashboard/workspace?organizationId=${organization.id}`);
}

export async function createTeamAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = teamSchema.parse({
    organizationId: formData.get("organizationId"),
    name: formData.get("name")
  });

  if (!isCeo(access, parsed.organizationId)) {
    throw new Error("Only the CEO can create teams.");
  }

  await prisma.team.create({
    data: {
      organizationId: parsed.organizationId,
      name: parsed.name
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
}

export async function archiveTeamAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = teamArchiveSchema.parse({
    teamId: formData.get("teamId")
  });
  const team = access.organizations
    .flatMap((organization) => organization.teams)
    .find((candidate) => candidate.id === parsed.teamId);

  if (!team || !isCeo(access, team.organizationId)) {
    throw new Error("Only the CEO can archive teams.");
  }

  await prisma.$transaction([
    prisma.team.update({
      where: { id: parsed.teamId },
      data: { archivedAt: new Date() }
    }),
    prisma.organizationInvitation.deleteMany({
      where: {
        teamId: parsed.teamId,
        acceptedAt: null
      }
    })
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
}

export async function restoreTeamAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = teamArchiveSchema.parse({
    teamId: formData.get("teamId")
  });
  const team = access.organizations
    .flatMap((organization) => organization.teams)
    .find((candidate) => candidate.id === parsed.teamId);

  if (!team || !isCeo(access, team.organizationId)) {
    throw new Error("Only the CEO can restore teams.");
  }

  await prisma.team.update({
    where: { id: parsed.teamId },
    data: { archivedAt: null }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
}

export async function addExistingMemberAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = memberSchema.parse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    role: formData.get("role")
  });

  if (!isCeo(access, parsed.organizationId)) {
    throw new Error("Only the CEO can add organization members.");
  }

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: parsed.email,
        mode: "insensitive"
      }
    }
  });

  if (!user) {
    throw new Error(
      "That user has not signed in yet. Create an invitation instead."
    );
  }

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: parsed.organizationId,
        userId: user.id
      }
    },
    update: {
      role: parsed.role
    },
    create: {
      organizationId: parsed.organizationId,
      userId: user.id,
      role: parsed.role
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workspace");
}

export async function createInvitationAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = inviteSchema.parse({
    organizationId: formData.get("organizationId"),
    email: formData.get("email"),
    organizationRole: formData.get("organizationRole"),
    teamId: formData.get("teamId") || undefined,
    teamRole: formData.get("teamRole") || undefined
  });

  if (!isCeo(access, parsed.organizationId)) {
    throw new Error("Only the CEO can invite organization members.");
  }

  if (parsed.teamId) {
    const team = access.organizations
      .flatMap((organization) => organization.teams)
      .find((candidate) => candidate.id === parsed.teamId);

    if (
      !team ||
      team.organizationId !== parsed.organizationId ||
      team.archivedAt
    ) {
      throw new Error("Selected team does not belong to the organization.");
    }
  }

  await prisma.organizationInvitation.create({
    data: {
      organizationId: parsed.organizationId,
      email: parsed.email,
      organizationRole: parsed.organizationRole,
      teamId: parsed.teamId,
      teamRole: parsed.teamId ? parsed.teamRole ?? "MEMBER" : null,
      token: randomBytes(24).toString("hex"),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      invitedById: access.user.id
    }
  });

  revalidatePath("/dashboard/workspace");
}

export async function assignTeamMemberAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = teamMemberSchema.parse({
    teamId: formData.get("teamId"),
    userId: formData.get("userId"),
    role: formData.get("role")
  });

  if (!canManageTeam(access, parsed.teamId)) {
    throw new Error("You cannot manage this team.");
  }

  const team = await prisma.team.findUnique({
    where: { id: parsed.teamId },
    select: { archivedAt: true, organizationId: true }
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  if (team.archivedAt) {
    throw new Error("Archived teams cannot be changed.");
  }

  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: team.organizationId,
        userId: parsed.userId
      }
    }
  });

  if (!member) {
    throw new Error("User must be an organization member first.");
  }

  await prisma.teamMember.upsert({
    where: {
      teamId_userId: {
        teamId: parsed.teamId,
        userId: parsed.userId
      }
    },
    update: {
      role: parsed.role
    },
    create: {
      teamId: parsed.teamId,
      userId: parsed.userId,
      role: parsed.role
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
}

export async function removeTeamMemberAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = removeTeamMemberSchema.parse({
    teamId: formData.get("teamId"),
    userId: formData.get("userId")
  });

  if (!canManageTeam(access, parsed.teamId)) {
    throw new Error("You cannot manage this team.");
  }

  await prisma.teamMember.deleteMany({
    where: {
      teamId: parsed.teamId,
      userId: parsed.userId
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
}

export async function updateOrganizationMemberRoleAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = updateOrganizationMemberSchema.parse({
    organizationId: formData.get("organizationId"),
    userId: formData.get("userId"),
    role: formData.get("role")
  });

  if (!isCeo(access, parsed.organizationId)) {
    throw new Error("Only the CEO can update organization members.");
  }

  await assertCanChangeOrganizationMember(
    parsed.organizationId,
    parsed.userId,
    parsed.role
  );

  await prisma.organizationMember.update({
    where: {
      organizationId_userId: {
        organizationId: parsed.organizationId,
        userId: parsed.userId
      }
    },
    data: {
      role: parsed.role
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workspace");
}

export async function removeOrganizationMemberAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = removeOrganizationMemberSchema.parse({
    organizationId: formData.get("organizationId"),
    userId: formData.get("userId")
  });

  if (!isCeo(access, parsed.organizationId)) {
    throw new Error("Only the CEO can remove organization members.");
  }

  await assertCanChangeOrganizationMember(parsed.organizationId, parsed.userId);

  const organizationTeams = await prisma.team.findMany({
    where: { organizationId: parsed.organizationId },
    select: { id: true }
  });

  await prisma.$transaction([
    prisma.teamMember.deleteMany({
      where: {
        userId: parsed.userId,
        teamId: {
          in: organizationTeams.map((team) => team.id)
        }
      }
    }),
    prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: parsed.organizationId,
          userId: parsed.userId
        }
      }
    })
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
}

export async function cancelInvitationAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = cancelInvitationSchema.parse({
    invitationId: formData.get("invitationId"),
    organizationId: formData.get("organizationId")
  });

  if (!isCeo(access, parsed.organizationId)) {
    throw new Error("Only the CEO can cancel invitations.");
  }

  await prisma.organizationInvitation.deleteMany({
    where: {
      id: parsed.invitationId,
      organizationId: parsed.organizationId,
      acceptedAt: null
    }
  });

  revalidatePath("/dashboard/workspace");
  revalidatePath("/onboarding");
}
