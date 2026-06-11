import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import {
  buildAccessibleMeetingWhere,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

export default async function MeetingDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  if (!userId) {
    notFound();
  }

  const access = await getUserMeetingAccess(userId);

  if (!access) {
    notFound();
  }

  const meeting = await prisma.meeting.findFirst({
    where: {
      AND: [{ id }, buildAccessibleMeetingWhere(access)]
    },
    include: {
      organization: true,
      team: true,
      actionItems: true,
      decisions: true,
      topics: true,
      followUpQuestions: true
    }
  });

  if (!meeting) {
    notFound();
  }

  const canDelete =
    meeting.userId === access.user.id ||
    Boolean(
      meeting.organizationId &&
        access.orgWideOrganizationIds.includes(meeting.organizationId)
    );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold text-slate-950 sm:text-3xl">
            {meeting.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Created {meeting.createdAt.toLocaleString()}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {meeting.organization?.name ?? "No organization"} /{" "}
            {meeting.team?.name ?? "No team"}
          </p>
        </div>
        {canDelete ? (
          <DeleteMeetingButton
            className="w-full sm:w-auto"
            meetingId={meeting.id}
          />
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
        <p className="mt-3 leading-7 text-slate-700">{meeting.summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Action items
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {meeting.actionItems.map((item) => (
              <li className="rounded-md bg-slate-50 p-3" key={item.id}>
                <span className="font-medium text-slate-950">{item.title}</span>
                <span className="block text-slate-500">
                  {item.assignee ?? "Unassigned"}
                  {item.deadline ? ` by ${item.deadline}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-950">Decisions</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {meeting.decisions.map((decision) => (
              <li key={decision.id}>{decision.content}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-950">Topics</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {meeting.topics.map((topic) => (
              <li key={topic.id}>
                <span className="font-medium text-slate-950">
                  {topic.title}
                </span>
                {topic.notes ? (
                  <p className="mt-1 text-slate-600">{topic.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Follow-up questions
          </h2>
          {meeting.followUpQuestions.length > 0 ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {meeting.followUpQuestions.map((followUp) => (
                <li key={followUp.id}>{followUp.question}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-500">
              No follow-up questions were detected in this transcript.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-slate-950">Transcript</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {meeting.transcript}
        </p>
      </section>
    </section>
  );
}
