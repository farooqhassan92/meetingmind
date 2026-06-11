import { auth, currentUser } from "@clerk/nextjs/server";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  Plus
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFilters } from "@/components/dashboard-filters";
import { MeetingHistoryList } from "@/components/meeting-history-list";
import { SemanticSearchPanel } from "@/components/semantic-search-panel";
import { Button } from "@/components/ui/button";
import {
  buildMeetingFilterWhere,
  dateInputValue,
  dateRangeOptions,
  getDateFilter,
  MEETING_HISTORY_PAGE_SIZE,
  type MeetingHistoryCard
} from "@/lib/meeting-history";
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

export default async function DashboardPage({
  searchParams
}: DashboardPageProps) {
  const params = await searchParams;
  const query = params?.query?.trim() ?? "";
  const range = params?.range ?? "all";
  const from = params?.from ?? "";
  const requestedOrganizationId = params?.organizationId ?? "";
  const requestedTeamId = params?.teamId ?? "";
  const to = params?.to ?? "";
  const dateFilter = getDateFilter(range, from, to);
  const filterWhere = buildMeetingFilterWhere({ dateFilter, query });
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
  const organizations = access?.organizations ?? [];
  const selectedOrganization = requestedOrganizationId
    ? organizations.find(
        (organization) => organization.id === requestedOrganizationId
      ) ?? null
    : null;
  const teams = selectedOrganization
    ? selectedOrganization.teams
    : organizations.flatMap((organization) => organization.teams);
  const selectedTeam = requestedTeamId
    ? teams.find((team) => team.id === requestedTeamId) ?? null
    : null;
  const selectedOrganizationId = selectedOrganization?.id;
  const selectedTeamId = selectedTeam?.id;
  const semanticFrom = dateFilter?.gte ? dateInputValue(dateFilter.gte) : from;
  const semanticTo = dateFilter?.lte ? dateInputValue(dateFilter.lte) : to;
  const accessibleWhere = access
    ? buildAccessibleMeetingWhere(access, {
        organizationId: selectedOrganizationId,
        teamId: selectedTeamId
      })
    : { id: "__no_access__" };
  const meetingWhere = {
    AND: [accessibleWhere, filterWhere]
  };
  const rawMeetings = access
    ? await prisma.meeting.findMany({
        where: meetingWhere,
        take: MEETING_HISTORY_PAGE_SIZE + 1,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          createdAt: true,
          organizationId: true,
          summary: true,
          title: true,
          userId: true,
          organization: {
            select: { name: true }
          },
          team: {
            select: { name: true }
          },
          _count: {
            select: { actionItems: true, decisions: true }
          }
        }
      })
    : [];
  const hasMoreMeetings = rawMeetings.length > MEETING_HISTORY_PAGE_SIZE;
  const meetings = hasMoreMeetings
    ? rawMeetings.slice(0, MEETING_HISTORY_PAGE_SIZE)
    : rawMeetings;
  const teamLabel = (team: (typeof teams)[number]) => {
    const organization = organizations.find(
      (candidate) => candidate.id === team.organizationId
    );

    return selectedOrganization
      ? team.name
      : `${organization ? organization.name : "Unknown org"} / ${team.name}`;
  };
  const hasActiveFilters = Boolean(
    query || range !== "all" || from || to || selectedOrganizationId || selectedTeamId
  );
  const [totalMeetingCount, totalActionItems, totalDecisions, visibleTeams] =
    access
      ? await Promise.all([
          prisma.meeting.count({ where: meetingWhere }),
          prisma.actionItem.count({ where: { meeting: meetingWhere } }),
          prisma.decision.count({ where: { meeting: meetingWhere } }),
          prisma.meeting.findMany({
            where: {
              AND: [meetingWhere, { teamId: { not: null } }]
            },
            distinct: ["teamId"],
            select: { teamId: true }
          })
        ])
      : [0, 0, 0, []];
  const historyCards: MeetingHistoryCard[] = meetings.map((meeting) => ({
    actionItemCount: meeting._count.actionItems,
    canDelete:
      meeting.userId === access?.user.id ||
      Boolean(
        meeting.organizationId &&
          access?.orgWideOrganizationIds.includes(meeting.organizationId)
      ),
    createdAt: meeting.createdAt.toISOString(),
    decisionCount: meeting._count.decisions,
    id: meeting.id,
    organizationName: meeting.organization?.name ?? null,
    summary: meeting.summary,
    teamName: meeting.team?.name ?? null,
    title: meeting.title
  }));
  const summaryStats = [
    {
      icon: CalendarDays,
      label: "Meetings",
      value: totalMeetingCount
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
      value: visibleTeams.length
    }
  ];

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

      <DashboardFilters
        dateRangeOptions={dateRangeOptions}
        from={from}
        hasActiveFilters={hasActiveFilters}
        maxDate={dateInputValue(new Date())}
        organizations={organizations}
        query={query}
        range={range}
        selectedOrganizationId={selectedOrganizationId ?? ""}
        selectedTeamId={selectedTeamId ?? ""}
        to={to}
      />

      <SemanticSearchPanel
        from={semanticFrom || undefined}
        organizationId={selectedOrganizationId}
        teamId={selectedTeamId}
        to={semanticTo || undefined}
      />

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
            {totalMeetingCount} matching result
            {totalMeetingCount === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {historyCards.length > 0 ? (
        <div className="space-y-3">
          {hasActiveFilters ? (
            <p className="text-sm text-slate-600">
              Showing {historyCards.length} of {totalMeetingCount} result
              {totalMeetingCount === 1 ? "" : "s"}
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
              {selectedOrganizationId ? (
                <>
                  {" "}
                  in{" "}
                  <span className="font-medium text-slate-950">
                    {selectedOrganization
                      ? selectedOrganization.name
                      : "selected organization"}
                  </span>
                </>
              ) : null}
              {selectedTeamId ? (
                <>
                  {" "}
                  for{" "}
                  <span className="font-medium text-slate-950">
                    {selectedTeam ? teamLabel(selectedTeam) : "selected team"}
                  </span>
                </>
              ) : null}
              .
            </p>
          ) : null}
          <MeetingHistoryList
            emptyDescription={
              hasActiveFilters
                ? "Try clearing filters or searching a broader term."
                : "Create your first meeting analysis to start building searchable history."
            }
            emptyTitle={hasActiveFilters ? "No matching meetings" : "No meetings yet"}
            filters={{
              from,
              organizationId: selectedOrganizationId,
              query,
              range,
              teamId: selectedTeamId,
              to
            }}
            hasMore={hasMoreMeetings}
            initialMeetings={historyCards}
            key={[
              query,
              range,
              from,
              to,
              selectedOrganizationId ?? "",
              selectedTeamId ?? ""
            ].join("|")}
            pageSize={MEETING_HISTORY_PAGE_SIZE}
          />
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
