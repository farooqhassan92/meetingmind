import { auth } from "@clerk/nextjs/server";
import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

type DashboardPageProps = {
  searchParams?: Promise<{
    from?: string;
    query?: string;
    range?: string;
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
  const to = params?.to ?? "";
  const dateFilter = getDateFilter(range, from, to);
  const meetingWhere: Prisma.MeetingWhereInput = {
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
  const user = userId
    ? await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
          meetings: {
            where: meetingWhere,
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
      <form action="/dashboard" className="flex flex-wrap gap-3">
        <label className="relative min-w-64 flex-1" htmlFor="meeting-search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={query}
            id="meeting-search"
            name="query"
            placeholder="Search meetings, decisions, topics..."
            type="search"
          />
        </label>
        <Button type="submit" variant="outline">
          <Search className="h-4 w-4" />
          Search
        </Button>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Date</span>
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>From</span>
          <input
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={from}
            max={to || undefined}
            name="from"
            type="date"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>To</span>
          <input
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            defaultValue={to}
            max={dateInputValue(new Date())}
            min={from || undefined}
            name="to"
            type="date"
          />
        </label>
        {query || range !== "all" || from || to ? (
          <Button asChild type="button" variant="outline">
            <Link href="/dashboard">
              <X className="h-4 w-4" />
              Clear
            </Link>
          </Button>
        ) : null}
      </form>
      {meetings.length > 0 ? (
        <div className="space-y-3">
          {query || range !== "all" || from || to ? (
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
              .
            </p>
          ) : null}
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
          {query ? "No meetings match your search." : "No meetings yet."}
        </div>
      )}
    </section>
  );
}
