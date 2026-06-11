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
    throw new Error("Invitation not found.");
  }

  if (invitation.acceptedAt) {
    redirect("/dashboard" as Route);
  }

  if (invitation.expiresAt < new Date()) {
    throw new Error("This invitation has expired.");
  }

  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("This invitation was sent to a different email address.");
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
