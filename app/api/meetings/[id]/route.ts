import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  buildAccessibleMeetingWhere,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getUserMeetingAccess(userId);

  if (!access) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const meeting = await prisma.meeting.findFirst({
    where: {
      AND: [
        { id },
        buildAccessibleMeetingWhere(access),
        {
          OR: [
            { userId: access.user.id },
            { organizationId: { in: access.orgWideOrganizationIds } }
          ]
        }
      ]
    },
    select: { id: true }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  await prisma.meeting.delete({
    where: { id: meeting.id }
  });

  return NextResponse.json({ ok: true });
}
