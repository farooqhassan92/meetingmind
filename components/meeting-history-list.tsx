"use client";

import { CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { friendlyClientError } from "@/lib/client-errors";
import type { MeetingHistoryCard } from "@/lib/meeting-history";

type MeetingHistoryListProps = {
  emptyDescription: string;
  emptyTitle: string;
  filters: {
    from?: string;
    organizationId?: string;
    query?: string;
    range?: string;
    teamId?: string;
    to?: string;
  };
  hasMore: boolean;
  initialMeetings: MeetingHistoryCard[];
  pageSize: number;
};

type MeetingsResponse = {
  meetings?: MeetingHistoryCard[];
  nextCursor?: string | null;
  error?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function MeetingHistoryList({
  emptyDescription,
  emptyTitle,
  filters,
  hasMore,
  initialMeetings,
  pageSize
}: MeetingHistoryListProps) {
  const { showToast } = useToast();
  const [meetings, setMeetings] = useState(initialMeetings);
  const [nextCursor, setNextCursor] = useState(
    initialMeetings.at(-1)?.id ?? null
  );
  const [canLoadMore, setCanLoadMore] = useState(hasMore);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onLoadMore() {
    if (!nextCursor) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("cursor", nextCursor);
      params.set("limit", String(pageSize));

      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          params.set(key, value);
        }
      }

      const response = await fetch(`/api/meetings?${params.toString()}`);
      const payload = (await response.json()) as MeetingsResponse;

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Could not load more meetings. Refresh the page and try again."
        );
      }

      const nextMeetings = payload.meetings ?? [];

      setMeetings((current) => [...current, ...nextMeetings]);
      setNextCursor(payload.nextCursor ?? null);
      setCanLoadMore(Boolean(payload.nextCursor));
    } catch (caught) {
      const message = friendlyClientError(
        caught,
        "Could not load more meetings. Refresh the page and try again."
      );

      setError(message);
      showToast({
        description: message,
        title: "Could not load meetings",
        variant: "error"
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (meetings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
        <h3 className="mt-3 text-lg font-semibold text-slate-950">
          {emptyTitle}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          {emptyDescription}
        </p>
        {emptyTitle === "No meetings yet" ? (
          <Button asChild className="mt-5">
            <Link href="/dashboard/new">New meeting</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
                  {meeting.organizationName ?? "No organization"}
                </span>
                <span className="rounded-md bg-teal-50 px-2 py-1 text-teal-700">
                  {meeting.teamName ?? "No team"}
                </span>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
              <span className="text-sm text-slate-500">
                {formatDate(meeting.createdAt)}
              </span>
              {meeting.canDelete ? (
                <DeleteMeetingButton
                  className="w-full sm:w-auto"
                  meetingId={meeting.id}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-md border border-slate-200 px-2 py-1">
              {meeting.actionItemCount} action items
            </span>
            <span className="rounded-md border border-slate-200 px-2 py-1">
              {meeting.decisionCount} decisions
            </span>
          </div>
        </div>
      ))}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {canLoadMore ? (
        <div className="flex justify-center pt-2">
          <Button
            disabled={isLoading}
            onClick={() => void onLoadMore()}
            type="button"
            variant="outline"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
