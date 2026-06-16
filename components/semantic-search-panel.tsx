"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { friendlyClientError } from "@/lib/client-errors";

type SemanticSearchResult = {
  chunkId: string;
  chunkType: string;
  content: string;
  distance: number;
  meetingCreatedAt: string;
  meetingId: string;
  meetingTitle: string;
  organizationName: string | null;
  teamName: string | null;
};

type AnswerSearchPayload = {
  answer?: string;
  error?: string;
  sources?: SemanticSearchResult[];
};

type SemanticSearchPanelProps = {
  from?: string;
  organizationId?: string;
  teamId?: string;
  to?: string;
};

function formatChunkType(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function similarityLabel(distance: number) {
  const similarity = Math.max(
    0,
    Math.min(100, Math.round((1 - distance) * 100))
  );

  return `${similarity}% match`;
}

export function SemanticSearchPanel({
  from,
  organizationId,
  teamId,
  to
}: SemanticSearchPanelProps) {
  const { showToast } = useToast();
  const [answer, setAnswer] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [mode, setMode] = useState<"answer" | "matches">("answer");
  const [isSearching, setIsSearching] = useState(false);

  async function onSearch(nextMode: "answer" | "matches") {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
      const message = "Search query must be at least 3 characters.";

      setError(message);
      showToast({
        description: message,
        title: "Search needs more detail",
        variant: "info"
      });
      return;
    }

    setError(null);
    setAnswer(null);
    setHasSearched(true);
    setMode(nextMode);
    setIsSearching(true);

    try {
      const response = await fetch(
        nextMode === "answer" ? "/api/search/answer" : "/api/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            limit: 8,
            organizationId,
            query: trimmedQuery,
            teamId,
            to
          })
        }
      );
      const payload = (await response.json()) as
        | AnswerSearchPayload
        | {
            error?: string;
            results?: SemanticSearchResult[];
          };

      if (!response.ok) {
        throw new Error(
          payload.error ??
            (nextMode === "answer"
              ? "Could not generate an answer. Try a narrower question or check that Ollama is running."
              : "Could not search meeting notes. Try again in a moment.")
        );
      }

      if (nextMode === "answer") {
        const answerPayload = payload as AnswerSearchPayload;
        setAnswer(answerPayload.answer ?? "");
        setResults(answerPayload.sources ?? []);
        showToast({
          description: "The answer was generated from matching meeting notes.",
          title: "Answer ready",
          variant: "success"
        });
      } else {
        const resultsPayload = payload as {
          results?: SemanticSearchResult[];
        };
        setResults(resultsPayload.results ?? []);
        showToast({
          description: `${resultsPayload.results?.length ?? 0} matching note${
            resultsPayload.results?.length === 1 ? "" : "s"
          } found.`,
          title: "Search complete",
          variant: "success"
        });
      }
    } catch (caught) {
      setAnswer(null);
      setResults([]);
      const message = friendlyClientError(
        caught,
        nextMode === "answer"
          ? "Could not generate an answer. Try a narrower question or check that Ollama is running."
          : "Could not search meeting notes. Try again in a moment."
      );

      setError(message);
      showToast({
        description: message,
        title: nextMode === "answer" ? "Answer failed" : "Search failed",
        variant: "error"
      });
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">
              AI search
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Ask in natural language across saved meeting notes.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1" htmlFor="semantic-search">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            id="semantic-search"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onSearch("answer");
              }
            }}
            placeholder="What launch blockers came up last month?"
            type="search"
            value={query}
          />
        </label>
        <Button
          className="w-full sm:w-auto"
          disabled={isSearching}
          onClick={() => void onSearch("answer")}
          type="button"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Answer
        </Button>
        <Button
          className="w-full sm:w-auto"
          disabled={isSearching}
          onClick={() => void onSearch("matches")}
          type="button"
          variant="outline"
        >
          <Search className="h-4 w-4" />
          Matches
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {hasSearched && !isSearching && !error ? (
        <div className="mt-4 space-y-3">
          {mode === "answer" && answer ? (
            <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm font-semibold text-teal-950">Answer</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                {answer}
              </p>
            </div>
          ) : null}
          {results.length > 0 ? (
            <>
              {mode === "answer" ? (
                <p className="pt-1 text-sm font-medium text-slate-700">
                  Sources
                </p>
              ) : null}
              {results.map((result) => (
                <Link
                  className="block rounded-md border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-teal-200 hover:bg-white"
                  href={`/dashboard/${result.meetingId}`}
                  key={result.chunkId}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-950">
                        {result.meetingTitle}
                      </p>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                        {result.content}
                      </p>
                    </div>
                    <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                      {similarityLabel(result.distance)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-md bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200">
                      {formatChunkType(result.chunkType)}
                    </span>
                    {result.organizationName ? (
                      <span className="rounded-md bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200">
                        {result.organizationName}
                      </span>
                    ) : null}
                    {result.teamName ? (
                      <span className="rounded-md bg-white px-2 py-1 text-slate-600 ring-1 ring-slate-200">
                        {result.teamName}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-500">
              {mode === "answer"
                ? "No source meetings found for that question."
                : "No semantic matches found."}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
