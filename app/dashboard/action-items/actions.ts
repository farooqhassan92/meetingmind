"use server";

import { auth } from "@clerk/nextjs/server";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buildAccessibleMeetingWhere,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

const updateActionItemSchema = z.object({
  actionItemId: z.string().min(1),
  assigneeUserId: z.string().optional(),
  deadline: z.string().trim().max(80).optional(),
  returnTo: z.string().min(1),
  title: z.string().trim().min(2).max(240)
});

const toggleActionItemSchema = z.object({
  actionItemId: z.string().min(1),
  completed: z.enum(["true", "false"]),
  returnTo: z.string().min(1)
});

async function requireActionItemAccess(actionItemId: string) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in" as Route);
  }

  const access = await getUserMeetingAccess(userId);

  if (!access) {
    throw new Error("Could not load your workspace access.");
  }

  const actionItem = await prisma.actionItem.findFirst({
    where: {
      id: actionItemId,
      meeting: buildAccessibleMeetingWhere(access)
    },
    include: {
      meeting: true
    }
  });

  if (!actionItem) {
    throw new Error("Action item not found, or you do not have access.");
  }

  return { access, actionItem };
}

function canManageActionItem({
  access,
  actionItem
}: Awaited<ReturnType<typeof requireActionItemAccess>>) {
  return Boolean(
    actionItem.meeting.userId === access.user.id ||
      (actionItem.meeting.organizationId &&
        access.orgWideOrganizationIds.includes(actionItem.meeting.organizationId)) ||
      (actionItem.meeting.teamId &&
        access.managedTeamIds.includes(actionItem.meeting.teamId))
  );
}

function redirectWithNotice(returnTo: string, notice: string): never {
  const url = new URL(returnTo, "http://meetingmind.local");
  url.searchParams.set("notice", notice);

  redirect(`${url.pathname}${url.search}` as Route);
}

export async function toggleActionItemAction(formData: FormData) {
  const parsed = toggleActionItemSchema.parse({
    actionItemId: formData.get("actionItemId"),
    completed: formData.get("completed"),
    returnTo: formData.get("returnTo")
  });
  const { actionItem } = await requireActionItemAccess(parsed.actionItemId);
  const completed = parsed.completed === "true";

  await prisma.actionItem.update({
    where: { id: actionItem.id },
    data: {
      completed,
      completedAt: completed ? new Date() : null
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/action-items");
  revalidatePath(`/dashboard/${actionItem.meetingId}`);
  redirectWithNotice(
    parsed.returnTo,
    completed ? "action-completed" : "action-reopened"
  );
}

export async function updateActionItemAction(formData: FormData) {
  const parsed = updateActionItemSchema.parse({
    actionItemId: formData.get("actionItemId"),
    assigneeUserId: formData.get("assigneeUserId") || undefined,
    deadline: formData.get("deadline") || undefined,
    returnTo: formData.get("returnTo"),
    title: formData.get("title")
  });
  const accessResult = await requireActionItemAccess(parsed.actionItemId);

  if (!canManageActionItem(accessResult)) {
    throw new Error("You can complete this action item, but cannot edit it.");
  }

  const { actionItem } = accessResult;
  const assignedUserId = parsed.assigneeUserId || null;

  if (assignedUserId) {
    if (!actionItem.meeting.organizationId && !actionItem.meeting.teamId) {
      throw new Error("This meeting does not have an assignable workspace.");
    }

    const member = await prisma.user.findFirst({
      where: {
        id: assignedUserId,
        OR: [
          ...(actionItem.meeting.organizationId
            ? [
                {
                  memberships: {
                    some: {
                      organizationId: actionItem.meeting.organizationId
                    }
                  }
                }
              ]
            : []),
          ...(actionItem.meeting.teamId
            ? [
                {
                  teamMemberships: {
                    some: {
                      teamId: actionItem.meeting.teamId
                    }
                  }
                }
              ]
            : [])
        ]
      },
      select: { id: true, name: true, email: true }
    });

    if (!member) {
      throw new Error("Selected assignee does not belong to this workspace.");
    }
  }

  await prisma.actionItem.update({
    where: { id: actionItem.id },
    data: {
      assignedUserId,
      deadline: parsed.deadline || null,
      title: parsed.title
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/action-items");
  revalidatePath(`/dashboard/${actionItem.meetingId}`);
  redirectWithNotice(parsed.returnTo, "action-updated");
}
