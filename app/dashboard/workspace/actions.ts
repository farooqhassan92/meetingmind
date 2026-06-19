"use server";

import { randomBytes } from "node:crypto";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { sendInvitationEmail } from "@/lib/invitation-email";
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
  email: z.string().trim().toLowerCase().email(),
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

const resendInvitationSchema = z.object({
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

function workspacePath({
  notice,
  organizationId,
  tab
}: {
  notice: string;
  organizationId: string;
  tab: "overview" | "teams" | "members" | "invites";
}) {
  const params = new URLSearchParams({
    notice,
    organizationId,
    tab
  });

  return `/dashboard/workspace?${params.toString()}` as Route;
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

async function sendAndRecordInvitationEmail(invitationId: string) {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { id: invitationId },
    include: {
      invitedBy: true,
      organization: true,
      team: true
    }
  });

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  const result = await sendInvitationEmail({
    email: invitation.email,
    invitedByName: invitation.invitedBy.name ?? invitation.invitedBy.email,
    organizationName: invitation.organization.name,
    organizationRole: invitation.organizationRole,
    teamName: invitation.team?.name ?? null,
    teamRole: invitation.teamRole,
    token: invitation.token
  });

  await prisma.organizationInvitation.update({
    where: { id: invitation.id },
    data: result.sent
      ? {
          emailError: null,
          emailMessageId: result.messageId,
          emailSentAt: new Date()
        }
      : {
          emailError: result.error
        }
  });
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
  redirect(
    workspacePath({
      notice: "organization-created",
      organizationId: organization.id,
      tab: "overview"
    })
  );
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
  redirect(
    workspacePath({
      notice: "team-created",
      organizationId: parsed.organizationId,
      tab: "teams"
    })
  );
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
  redirect(
    workspacePath({
      notice: "team-archived",
      organizationId: team.organizationId,
      tab: "teams"
    })
  );
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
  redirect(
    workspacePath({
      notice: "team-restored",
      organizationId: team.organizationId,
      tab: "teams"
    })
  );
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
  redirect(
    workspacePath({
      notice: "existing-member-added",
      organizationId: parsed.organizationId,
      tab: "members"
    })
  );
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

  const existingMember = await prisma.organizationMember.findFirst({
    where: {
      organizationId: parsed.organizationId,
      user: {
        email: {
          equals: parsed.email,
          mode: "insensitive"
        }
      }
    },
    select: { id: true }
  });

  if (existingMember) {
    throw new Error(
      "This user is already a member of the organization. Assign them to a team from the Teams tab instead."
    );
  }

  const existingPendingInvite = await prisma.organizationInvitation.findFirst({
    where: {
      acceptedAt: null,
      email: {
        equals: parsed.email,
        mode: "insensitive"
      },
      organizationId: parsed.organizationId,
      teamId: parsed.teamId ?? null
    },
    select: { id: true }
  });

  if (existingPendingInvite) {
    throw new Error(
      "A pending invitation already exists for this email and team. Resend the existing invitation instead."
    );
  }

  const invitation = await prisma.organizationInvitation.create({
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

  await sendAndRecordInvitationEmail(invitation.id);

  revalidatePath("/dashboard/workspace");
  redirect(
    workspacePath({
      notice: "invite-created",
      organizationId: parsed.organizationId,
      tab: "invites"
    })
  );
}

export async function resendInvitationEmailAction(formData: FormData) {
  const access = await requireAccess();
  const parsed = resendInvitationSchema.parse({
    invitationId: formData.get("invitationId"),
    organizationId: formData.get("organizationId")
  });

  if (!isCeo(access, parsed.organizationId)) {
    throw new Error("Only the CEO can resend invitations.");
  }

  const invitation = await prisma.organizationInvitation.findFirst({
    where: {
      acceptedAt: null,
      id: parsed.invitationId,
      organizationId: parsed.organizationId
    },
    select: { id: true }
  });

  if (!invitation) {
    throw new Error("Invitation not found.");
  }

  await sendAndRecordInvitationEmail(invitation.id);

  revalidatePath("/dashboard/workspace");
  redirect(
    workspacePath({
      notice: "invite-resent",
      organizationId: parsed.organizationId,
      tab: "invites"
    })
  );
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
  redirect(
    workspacePath({
      notice: "team-member-assigned",
      organizationId: team.organizationId,
      tab: "teams"
    })
  );
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

  const team = await prisma.team.findUnique({
    where: { id: parsed.teamId },
    select: { organizationId: true }
  });

  if (!team) {
    throw new Error("Team not found.");
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
  redirect(
    workspacePath({
      notice: "team-member-removed",
      organizationId: team.organizationId,
      tab: "teams"
    })
  );
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
  redirect(
    workspacePath({
      notice: "member-role-updated",
      organizationId: parsed.organizationId,
      tab: "members"
    })
  );
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
  redirect(
    workspacePath({
      notice: "member-removed",
      organizationId: parsed.organizationId,
      tab: "members"
    })
  );
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
  redirect(
    workspacePath({
      notice: "invite-cancelled",
      organizationId: parsed.organizationId,
      tab: "invites"
    })
  );
}
