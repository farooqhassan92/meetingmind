import { auth } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";
import Link from "next/link";

import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = userId
    ? await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
          meetings: {
            orderBy: { createdAt: "desc" },
            include: {
              _count: {
                select: { actionItems: true, decisions: true }
              }
            }
          }
        }
      })
    : null;
  const meetings = user?.meetings ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">
            Meeting history
          </h1>
          <p className="mt-2 text-slate-600">
            Review saved meeting summaries, decisions, and action items.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            New meeting
          </Link>
        </Button>
      </div>
      {meetings.length > 0 ? (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              key={meeting.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    className="font-semibold text-slate-950 transition-colors hover:text-teal-700"
                    href={`/dashboard/${meeting.id}`}
                  >
                    {meeting.title}
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {meeting.summary}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {meeting.createdAt.toLocaleDateString()}
                  </span>
                  <DeleteMeetingButton meetingId={meeting.id} />
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {meeting._count.actionItems} action items /{" "}
                {meeting._count.decisions} decisions
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No meetings yet.
        </div>
      )}
    </section>
  );
}
