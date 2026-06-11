import { auth, currentUser } from "@clerk/nextjs/server";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Plus,
  Search,
  X
} from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  buildAccessibleMeetingWhere,
  ensureAppUser,
  getUserMeetingAccess
} from "@/lib/organization-access";
import { prisma } from "@/lib/prisma";

type DashboardPageProps = {
  searchParams?: Promise<{
    from?: string;
    organizationId?: string;
    query?: string;
    range?: string;
    teamId?: string;
    to?: string;
  }>;
};

const dateRangeOptions = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this-month", label: "This month" },
  { value: "custom", label: "Custom range" }
];

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string | undefined, boundary: "start" | "end") {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  if (boundary === "end") {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function getDateFilter(range: string, from?: string, to?: string) {
  const now = new Date();
  const selectedRange = dateRangeOptions.some((option) => option.value === range)
    ? range
    : "all";

  if (selectedRange === "custom" || from || to) {
    const gte = parseDateInput(from, "start");
    const lte = parseDateInput(to, "end");

    return gte || lte ? { gte, lte } : undefined;
  }

  if (selectedRange === "7d" || selectedRange === "30d") {
    const days = selectedRange === "7d" ? 7 : 30;
    const gte = new Date(now);
    gte.setDate(gte.getDate() - days);

    return { gte };
  }

  if (selectedRange === "this-month") {
    return {
      gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    };
  }

  return undefined;
}

export default async function DashboardPage({
  searchParams
}: DashboardPageProps) {
  const params = await searchParams;
  const query = params?.query?.trim() ?? "";
  const range = params?.range ?? "all";
  const from = params?.from ?? "";
  const organizationId = params?.organizationId ?? "";
  const teamId = params?.teamId ?? "";
  const to = params?.to ?? "";
  const dateFilter = getDateFilter(range, from, to);
  const filterWhere: Prisma.MeetingWhereInput = {
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
            { transcript: { contains: query, mode: "insensitive" } },
            {
              actionItems: {
                some: {
                  title: { contains: query, mode: "insensitive" }
                }
              }
            },
            {
              decisions: {
                some: {
                  content: { contains: query, mode: "insensitive" }
                }
              }
            },
            {
              topics: {
                some: {
                  OR: [
                    {
                      title: {
                        contains: query,
                        mode: "insensitive"
                      }
                    },
                    {
                      notes: {
                        contains: query,
                        mode: "insensitive"
                      }
                    }
                  ]
                }
              }
            },
            {
              followUpQuestions: {
                some: {
                  question: { contains: query, mode: "insensitive" }
                }
              }
            }
          ]
        }
      : {})
  };
  const { userId } = await auth();
  const clerkUser = userId ? await currentUser() : null;

  if (
    userId &&
    clerkUser?.primaryEmailAddress?.emailAddress
  ) {
    await ensureAppUser({
      clerkId: userId,
      email: clerkUser.primaryEmailAddress.emailAddress,
      name: clerkUser.fullName ?? clerkUser.username ?? null
    });
  }

  const access = userId ? await getUserMeetingAccess(userId) : null;

  if (userId && access && access.memberships.length === 0) {
    redirect("/onboarding" as Route);
  }
  const selectedOrganizationId = organizationId || undefined;
  const selectedTeamId = teamId || undefined;
  const accessibleWhere = access
    ? buildAccessibleMeetingWhere(access, {
        organizationId: selectedOrganizationId,
        teamId: selectedTeamId
      })
    : { id: "__no_access__" };
  const meetings = access
    ? await prisma.meeting.findMany({
        where: {
          AND: [accessibleWhere, filterWhere]
        },
        orderBy: { createdAt: "desc" },
        include: {
          organization: true,
          team: true,
          _count: {
            select: { actionItems: true, decisions: true }
          }
        }
      })
    : [];
  const organizations = access?.organizations ?? [];
  const selectedOrganization = selectedOrganizationId
    ? organizations.find((organization) => organization.id === selectedOrganizationId)
    : null;
  const teams = selectedOrganization
    ? selectedOrganization.teams
    : organizations.flatMap((organization) => organization.teams);
  const hasActiveFilters = Boolean(
    query || range !== "all" || from || to || organizationId || teamId
  );
  const totalActionItems = meetings.reduce(
    (count, meeting) => count + meeting._count.actionItems,
    0
  );
  const totalDecisions = meetings.reduce(
    (count, meeting) => count + meeting._count.decisions,
    0
  );
  const visibleTeamCount = new Set(
    meetings.map((meeting) => meeting.teamId).filter(Boolean)
  ).size;
  const summaryStats = [
    {
      icon: CalendarDays,
      label: "Meetings",
      value: meetings.length
    },
    {
      icon: ListChecks,
      label: "Action items",
      value: totalActionItems
    },
    {
      icon: CheckCircle2,
      label: "Decisions",
      value: totalDecisions
    },
    {
      icon: Building2,
      label: "Teams",
      value: visibleTeamCount
    }
  ];
  const canDeleteMeeting = (meeting: (typeof meetings)[number]) =>
    meeting.userId === access?.user.id ||
    Boolean(
      meeting.organizationId &&
        access?.orgWideOrganizationIds.includes(meeting.organizationId)
    );

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
              Meeting intelligence
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">
              Meeting history
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Search decisions, action items, transcripts, and team context from
              one place.
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/new">
              <Plus className="h-4 w-4" />
              New meeting
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {summaryStats.map((stat) => (
            <div
              className="rounded-md border border-slate-200 bg-slate-50 p-4"
              key={stat.label}
            >
              <stat.icon className="h-5 w-5 text-teal-700" />
              <p className="mt-3 text-2xl font-semibold text-slate-950">
                {stat.value}
              </p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <form
        action="/dashboard"
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.8fr]">
          <label className="relative" htmlFor="meeting-search">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </span>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-slate-400" />
            <input
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={query}
              id="meeting-search"
              name="query"
              placeholder="Search meetings, decisions, topics..."
              type="search"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            <Tooltip content="Organizations are company workspaces that own teams, meetings, and members.">
              <span>Organization</span>
            </Tooltip>
            <select
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={organizationId}
              name="organizationId"
            >
              <option value="">All organizations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            <Tooltip content="Teams limit meeting access and help narrow search results to the right group.">
              <span>Team</span>
            </Tooltip>
            <select
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={teamId}
              name="teamId"
            >
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            <Tooltip content="Date filters search by when meetings were created.">
              <span>Date</span>
            </Tooltip>
            <select
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={range}
              name="range"
            >
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <label className="text-sm font-medium text-slate-700">
            From
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={from}
              max={to || undefined}
              name="from"
              type="date"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              defaultValue={to}
              max={dateInputValue(new Date())}
              min={from || undefined}
              name="to"
              type="date"
            />
          </label>
          <Button className="w-full sm:w-auto" type="submit" variant="outline">
            <Search className="h-4 w-4" />
            Apply filters
          </Button>
          {hasActiveFilters ? (
            <Button asChild className="w-full sm:w-auto" type="button" variant="outline">
              <Link href="/dashboard">
                <X className="h-4 w-4" />
                Clear
              </Link>
            </Button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Saved meetings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Latest meetings appear first.
          </p>
        </div>
        {hasActiveFilters ? (
          <span className="rounded-md bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800">
            {meetings.length} matching result{meetings.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {meetings.length > 0 ? (
        <div className="space-y-3">
          {hasActiveFilters ? (
            <p className="text-sm text-slate-600">
              Showing {meetings.length} result
              {meetings.length === 1 ? "" : "s"}
              {query ? (
                <>
                  {" "}
                  for{" "}
                  <span className="font-medium text-slate-950">{query}</span>
                </>
              ) : null}
              {from || to ? (
                <>
                  {" "}
                  from{" "}
                  <span className="font-medium text-slate-950">
                    {from || "the beginning"}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-slate-950">
                    {to || "today"}
                  </span>
                </>
              ) : range !== "all" ? (
                <>
                  {" "}
                  in{" "}
                  <span className="font-medium text-slate-950">
                    {
                      dateRangeOptions.find((option) => option.value === range)
                        ?.label
                    }
                  </span>
                </>
              ) : null}
              {organizationId ? (
                <>
                  {" "}
                  in{" "}
                  <span className="font-medium text-slate-950">
                    {selectedOrganization?.name ?? "selected organization"}
                  </span>
                </>
              ) : null}
              {teamId ? (
                <>
                  {" "}
                  for{" "}
                  <span className="font-medium text-slate-950">
                    {teams.find((team) => team.id === teamId)?.name ??
                      "selected team"}
                  </span>
                </>
              ) : null}
              .
            </p>
          ) : null}
          {meetings.map((meeting) => (
            <div
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-teal-200"
              key={meeting.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    className="text-lg font-semibold text-slate-950 transition-colors hover:text-teal-700"
                    href={`/dashboard/${meeting.id}`}
                  >
                    {meeting.title}
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {meeting.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                      {meeting.organization?.name ?? "No organization"}
                    </span>
                    <span className="rounded-md bg-teal-50 px-2 py-1 text-teal-700">
                      {meeting.team?.name ?? "No team"}
                    </span>
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
                  <span className="text-sm text-slate-500">
                    {meeting.createdAt.toLocaleDateString()}
                  </span>
                  {canDeleteMeeting(meeting) ? (
                    <DeleteMeetingButton
                      className="w-full sm:w-auto"
                      meetingId={meeting.id}
                    />
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-md border border-slate-200 px-2 py-1">
                  {meeting._count.actionItems} action items
                </span>
                <span className="rounded-md border border-slate-200 px-2 py-1">
                  {meeting._count.decisions} decisions
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {hasActiveFilters ? "No matching meetings" : "No meetings yet"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {hasActiveFilters
              ? "Try clearing filters or searching a broader term."
              : "Create your first meeting analysis to start building searchable history."}
          </p>
          {!hasActiveFilters ? (
            <Button asChild className="mt-5">
              <Link href="/dashboard/new">
                <Plus className="h-4 w-4" />
                New meeting
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
