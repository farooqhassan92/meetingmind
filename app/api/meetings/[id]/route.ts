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
    return NextResponse.json(
      { error: "Could not verify your access to this meeting." },
      { status: 403 }
    );
  }

  let meeting;

  try {
    meeting = await prisma.meeting.findFirst({
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
  } catch (caught) {
    console.error("Could not check meeting before deletion.", caught);

    return NextResponse.json(
      { error: "Could not check this meeting. Please try again." },
      { status: 500 }
    );
  }

  if (!meeting) {
    return NextResponse.json(
      {
        error:
          "Meeting not found. It may have already been deleted, or you may not have permission to remove it."
      },
      { status: 404 }
    );
  }

  try {
    await prisma.meeting.delete({
      where: { id: meeting.id }
    });
  } catch (caught) {
    console.error("Could not delete meeting.", caught);

    return NextResponse.json(
      { error: "Could not delete this meeting. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
