"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingAnalysis } from "@/mcp-server/src/llm/schemas";

export function MeetingForm() {
  const [transcript, setTranscript] = useState("");
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function onAnalyze() {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in to analyze a meeting.");
        }

        throw new Error("Analysis failed");
      }

      const payload = (await response.json()) as { analysis: MeetingAnalysis };
      setAnalysis(payload.analysis);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="transcript"
        >
          Transcript
        </label>
        <Textarea
          className="mt-3 min-h-80"
          id="transcript"
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Paste a transcript..."
          value={transcript}
        />
        <Button
          className="mt-4"
          disabled={isLoading || transcript.trim().length < 20}
          onClick={onAnalyze}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Analyze
        </Button>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Results</h2>
        {analysis ? (
          <div className="mt-4 space-y-5 text-sm text-slate-700">
            <section>
              <h3 className="font-semibold text-slate-950">Summary</h3>
              <p className="mt-2 leading-6">{analysis.summary}</p>
            </section>
            <section>
              <h3 className="font-semibold text-slate-950">Action items</h3>
              <ul className="mt-2 space-y-2">
                {analysis.actionItems.map((item) => (
                  <li className="rounded-md bg-slate-50 p-3" key={item.title}>
                    <span className="font-medium">{item.title}</span>
                    <span className="block text-slate-500">
                      {item.assignee ?? "Unassigned"}
                      {item.deadline ? ` by ${item.deadline}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="font-semibold text-slate-950">Decisions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {analysis.decisions.map((decision) => (
                  <li key={decision}>{decision}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Structured notes will appear here after analysis.
          </p>
        )}
      </div>
    </div>
  );
}
