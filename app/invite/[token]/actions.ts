"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import type { Route } from "next";
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
    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: user.id
        }
      },
      update: {
        role: invitation.organizationRole
      },
      create: {
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.organizationRole
      }
    });

    if (invitation.teamId && invitation.teamRole) {
      await tx.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: invitation.teamId,
            userId: user.id
          }
        },
        update: {
          role: invitation.teamRole
        },
        create: {
          teamId: invitation.teamId,
          userId: user.id,
          role: invitation.teamRole
        }
      });
    }

    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        acceptedAt: new Date(),
        acceptedById: user.id
      }
    });
  });

  redirect("/dashboard" as Route);
}
