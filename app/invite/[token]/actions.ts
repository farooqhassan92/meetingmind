"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ensureAppUser } from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

const acceptInviteSchema = z.object({
  token: z.string().min(1)
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function describeEmail(email: string) {
  const [local, domain] = normalizeEmail(email).split("@");

  if (!local || !domain) {
    return email;
  }

  return `${local.slice(0, 3)}***@${domain}`;
}

function bestOrganizationRole(
  invitations: { organizationRole: "CEO" | "MEMBER" }[]
) {
  return invitations.some((candidate) => candidate.organizationRole === "CEO")
    ? "CEO"
    : "MEMBER";
}

function bestTeamRoles(
  invitations: {
    teamId: string | null;
    teamRole: "MANAGER" | "MEMBER" | null;
  }[]
) {
  const roles = new Map<string, "MANAGER" | "MEMBER">();

  for (const invitation of invitations) {
    if (!invitation.teamId || !invitation.teamRole) {
      continue;
    }

    const currentRole = roles.get(invitation.teamId);

    if (!currentRole || invitation.teamRole === "MANAGER") {
      roles.set(invitation.teamId, invitation.teamRole);
    }
  }

  return roles;
}

export async function acceptInvitationAction(formData: FormData) {
  const parsed = acceptInviteSchema.parse({
    token: formData.get("token")
  });
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in" as Route);
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  const userEmails =
    clerkUser?.emailAddresses
      .map((address) => address.emailAddress)
      .filter(Boolean) ?? [];

  if (!email) {
    throw new Error("Signed-in user is missing a primary email address.");
  }

  const user = await ensureAppUser({
    clerkId: userId,
    email,
    name: clerkUser.fullName ?? clerkUser.username ?? null
  });
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token: parsed.token }
  });

  if (!invitation) {
    throw new Error(
      "Invitation not found. It may have been cancelled or replaced. Ask your CEO for a new invite."
    );
  }

  if (invitation.acceptedAt) {
    redirect("/dashboard" as Route);
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error("This invitation has expired.");
  }

  const invitedEmail = normalizeEmail(invitation.email);
  const signedInEmails = new Set(userEmails.map(normalizeEmail));

  if (!signedInEmails.has(invitedEmail)) {
    throw new Error(
      `This invite was sent to ${describeEmail(invitation.email)}, but you are signed in with ${describeEmail(email)}. Please sign out and use the invited email.`
    );
  }

  await prisma.$transaction(async (tx) => {
    const pendingInvitations = await tx.organizationInvitation.findMany({
      where: {
        acceptedAt: null,
        email: {
          equals: invitation.email,
          mode: "insensitive"
        },
        expiresAt: {
          gte: new Date()
        },
        organizationId: invitation.organizationId
      },
      select: {
        organizationRole: true,
        teamId: true,
        teamRole: true
      }
    });
    const organizationRole = bestOrganizationRole(pendingInvitations);
    const teamRoles = bestTeamRoles(pendingInvitations);

    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: user.id
        }
      },
      update: {
        role: organizationRole
      },
      create: {
        organizationId: invitation.organizationId,
        userId: user.id,
        role: organizationRole
      }
    });

    for (const [teamId, teamRole] of teamRoles) {
      await tx.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId,
            userId: user.id
          }
        },
        update: {
          role: teamRole
        },
        create: {
          teamId,
          userId: user.id,
          role: teamRole
        }
      });
    }

    await tx.organizationInvitation.updateMany({
      where: {
        acceptedAt: null,
        email: {
          equals: invitation.email,
          mode: "insensitive"
        },
        organizationId: invitation.organizationId
      },
      data: {
        acceptedAt: new Date(),
        acceptedById: user.id
      }
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/new");
  revalidatePath("/dashboard/workspace");
  revalidatePath("/onboarding");

  redirect("/dashboard" as Route);
}
