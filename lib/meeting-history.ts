import type { Prisma } from "@prisma/client";

export const MEETING_HISTORY_PAGE_SIZE = 10;

export const dateRangeOptions = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this-month", label: "This month" },
  { value: "custom", label: "Custom range" }
];

export type MeetingHistoryCard = {
  actionItemCount: number;
  canDelete: boolean;
  createdAt: string;
  decisionCount: number;
  id: string;
  organizationName: string | null;
  summary: string;
  teamName: string | null;
  title: string;
};

export function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseDateInput(
  value: string | undefined,
  boundary: "start" | "end"
) {
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

export function getDateFilter(range: string, from?: string, to?: string) {
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

export function buildMeetingFilterWhere({
  dateFilter,
  query
}: {
  dateFilter?: { gte?: Date; lte?: Date };
  query: string;
}): Prisma.MeetingWhereInput {
  return {
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
}
