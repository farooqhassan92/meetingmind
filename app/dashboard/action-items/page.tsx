import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { CheckCircle2, Circle, ClipboardList, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActionItemNoticeToast } from "@/components/action-item-notice-toast";
import { ActionItemWorkflow } from "@/components/action-item-workflow";
import { Button } from "@/components/ui/button";
import {
  canManageMeetingActionItems,
  getActionItemAssigneesForAccess
} from "@/lib/action-items";
import {
  buildAccessibleMeetingWhere,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

type ActionItemsPageProps = {
  searchParams?: Promise<{
    assignee?: string;
    notice?: string;
    query?: string;
    status?: string;
  }>;
};

const statusOptions = [
  { label: "Open", value: "open" },
  { label: "Completed", value: "completed" },
  { label: "All", value: "all" }
];

const assigneeOptions = [
  { label: "All assignees", value: "all" },
  { label: "Assigned to me", value: "me" },
  { label: "Unassigned", value: "unassigned" }
];

export default async function ActionItemsPage({
  searchParams
}: ActionItemsPageProps) {
  const params = await searchParams;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in" as Route);
  }

  const access = await getUserMeetingAccess(userId);

  if (!access || access.memberships.length === 0) {
    redirect("/onboarding" as Route);
  }

  const status = statusOptions.some((option) => option.value === params?.status)
    ? params?.status ?? "open"
    : "open";
  const assignee = assigneeOptions.some(
    (option) => option.value === params?.assignee
  )
    ? params?.assignee ?? "all"
    : "all";
  const query = params?.query?.trim() ?? "";
  const filters: Prisma.ActionItemWhereInput[] = [
    {
      meeting: buildAccessibleMeetingWhere(access)
    }
  ];

  if (status !== "all") {
    filters.push({ completed: status === "completed" });
  }

  if (assignee === "me") {
    filters.push({ assignedUserId: access.user.id });
  }

  if (assignee === "unassigned") {
    filters.push({ assignedUserId: null });
  }

  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { assignee: { contains: query, mode: "insensitive" } },
        {
          meeting: {
            title: { contains: query, mode: "insensitive" }
          }
        }
      ]
    });
  }

  const [items, assignees, openCount, myOpenCount, completedCount] =
    await Promise.all([
      prisma.actionItem.findMany({
        where: { AND: filters },
        include: {
          assignedUser: {
            select: {
              email: true,
              id: true,
              name: true
            }
          },
          meeting: {
            select: {
              id: true,
              organizationId: true,
              teamId: true,
              title: true,
              userId: true
            }
          }
        },
        orderBy: [
          { completed: "asc" },
          { createdAt: "desc" },
          { id: "desc" }
        ],
        take: 100
      }),
      getActionItemAssigneesForAccess(access),
      prisma.actionItem.count({
        where: {
          completed: false,
          meeting: buildAccessibleMeetingWhere(access)
        }
      }),
      prisma.actionItem.count({
        where: {
          assignedUserId: access.user.id,
          completed: false,
          meeting: buildAccessibleMeetingWhere(access)
        }
      }),
      prisma.actionItem.count({
        where: {
          completed: true,
          meeting: buildAccessibleMeetingWhere(access)
        }
      })
    ]);
  const returnParams = new URLSearchParams();

  if (status !== "open") {
    returnParams.set("status", status);
  }

  if (assignee !== "all") {
    returnParams.set("assignee", assignee);
  }

  if (query) {
    returnParams.set("query", query);
  }

  const returnTo = `/dashboard/action-items${
    returnParams.toString() ? `?${returnParams.toString()}` : ""
  }`;
  const workflowItems = items.map((item) => ({
    ...item,
    canManage: canManageMeetingActionItems(access, item.meeting),
    meetingId: item.meeting.id,
    meetingTitle: item.meeting.title
  }));

  return (
    <section className="space-y-6">
      <ActionItemNoticeToast notice={params?.notice} />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
              Execution
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">
              Action items
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Track follow-through across meetings, owners, and teams.
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto" variant="outline">
            <Link href="/dashboard">Back to history</Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <Circle className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {openCount}
            </p>
            <p className="text-sm text-slate-500">Open</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <ClipboardList className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {myOpenCount}
            </p>
            <p className="text-sm text-slate-500">Assigned to me</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-teal-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {completedCount}
            </p>
            <p className="text-sm text-slate-500">Completed</p>
          </div>
        </div>
      </div>

      <form
        action="/dashboard/action-items"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_0.5fr_0.6fr_auto]">
          <label className="relative" htmlFor="action-query">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </span>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={query}
              id="action-query"
              name="query"
              placeholder="Search actions or meetings..."
              type="search"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Status
            <select
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={status}
              name="status"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Assignee
            <select
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={assignee}
              name="assignee"
            >
              {assigneeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button className="w-full self-end lg:w-auto" type="submit">
            <Search className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Matching action items
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {items.length} item{items.length === 1 ? "" : "s"} shown.
            </p>
          </div>
          {query || status !== "open" || assignee !== "all" ? (
            <Button asChild variant="outline">
              <Link href="/dashboard/action-items">Clear filters</Link>
            </Button>
          ) : null}
        </div>

        <ActionItemWorkflow
          assignees={assignees}
          canManage={false}
          emptyMessage="No action items match the current filters."
          items={workflowItems}
          returnTo={returnTo}
          showMeetingTitle
        />
      </section>
    </section>
  );
}
