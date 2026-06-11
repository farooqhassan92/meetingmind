"use client";

import {
  Building2,
  ClipboardList,
  FileAudio,
  Loader2,
  Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import type { MeetingAnalysis } from "@/mcp-server/src/llm/schemas";

type MeetingFormOrganization = {
  id: string;
  name: string;
  teams: {
    id: string;
    name: string;
  }[];
};

type MeetingFormProps = {
  organizations?: MeetingFormOrganization[];
};

export function MeetingForm({ organizations = [] }: MeetingFormProps) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(
    organizations[0]?.id ?? ""
  );
  const selectedOrganization = useMemo(
    () =>
      organizations.find((organization) => organization.id === organizationId),
    [organizationId, organizations]
  );
  const teams = selectedOrganization?.teams ?? [];
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [transcript, setTranscript] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  function readFileAsBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          reject(new Error("Could not read the selected audio file."));
          return;
        }

        const [, base64] = result.split(",");

        if (!base64) {
          reject(new Error("Could not prepare the selected audio file."));
          return;
        }

        resolve(base64);
      };
      reader.onerror = () => {
        reject(new Error("Could not read the selected audio file."));
      };
      reader.readAsDataURL(file);
    });
  }

  async function readJsonResponse<T>(response: Response) {
    const text = await response.text();

    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text);
    }
  }

  async function onTranscribe() {
    if (!audioFile) {
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionStatus("Preparing audio...");

    try {
      const audioBase64 = await readFileAsBase64(audioFile);
      setTranscriptionStatus("Transcribing audio...");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          fileName: audioFile.name,
          mimeType: audioFile.type || "application/octet-stream"
        })
      });

      const payload = await readJsonResponse<{
        transcript?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in to transcribe audio.");
        }

        throw new Error(payload.error ?? "Transcription failed");
      }

      if (!payload.transcript) {
        throw new Error("Transcription completed without transcript text.");
      }

      setTranscript(payload.transcript);
      setTranscriptionStatus("Transcript ready.");
    } catch (caught) {
      setTranscriptionStatus(null);
      setTranscriptionError(
        caught instanceof Error ? caught.message : "Transcription failed"
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  async function onAnalyze() {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organizationId || undefined,
          teamId: teamId || undefined,
          transcript
        })
      });

      const payload = await readJsonResponse<{
        analysis: MeetingAnalysis;
        meetingId?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in to analyze a meeting.");
        }

        throw new Error(payload.error ?? "Analysis failed");
      }
      setAnalysis(payload.analysis);

      if (payload.meetingId) {
        router.push(`/dashboard/${payload.meetingId}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">
              Meeting scope
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Choose where this meeting belongs before analysis so search and
            permissions stay accurate.
          </p>
          {organizations.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              <Tooltip content="The organization controls who can search and view this meeting.">
                <span>Organization</span>
              </Tooltip>
              <select
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(event) => {
                  const nextOrganizationId = event.target.value;
                  const nextOrganization = organizations.find(
                    (organization) => organization.id === nextOrganizationId
                  );

                  setOrganizationId(nextOrganizationId);
                  setTeamId(nextOrganization?.teams[0]?.id ?? "");
                }}
                value={organizationId}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              <Tooltip content="The selected team determines which managers and members can access this meeting.">
                <span>Team</span>
              </Tooltip>
              <select
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(event) => setTeamId(event.target.value)}
                value={teamId}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <FileAudio className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">
              Audio upload
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Upload a recording to create a transcript, or skip this and paste a
            transcript below.
          </p>
          <label
            className="mt-4 block text-sm font-medium text-slate-700"
            htmlFor="audio-file"
          >
            Audio recording
          </label>
          <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <input
              accept="audio/*,video/mp4,.mp4,.m4a"
              className="block min-w-0 flex-1 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
              disabled={isTranscribing}
              id="audio-file"
              onChange={(event) => {
                setAudioFile(event.target.files?.[0] ?? null);
                setTranscriptionError(null);
                setTranscriptionStatus(null);
              }}
              type="file"
            />
            <Button
              className="w-full sm:w-auto"
              disabled={!audioFile || isTranscribing}
              onClick={onTranscribe}
              type="button"
              variant="outline"
            >
              {isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileAudio className="h-4 w-4" />
              )}
              Transcribe
            </Button>
          </div>
          {audioFile ? (
            <p className="mt-2 text-xs text-slate-500">
              Selected {audioFile.name}
            </p>
          ) : null}
          {transcriptionStatus ? (
            <p className="mt-3 text-sm text-teal-700">
              {transcriptionStatus}
            </p>
          ) : null}
          {transcriptionError ? (
            <p className="mt-3 text-sm text-red-600">{transcriptionError}</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">
              Transcript
            </h2>
          </div>
          <label
            className="mt-4 block text-sm font-medium text-slate-700"
            htmlFor="transcript"
          >
            Meeting transcript
          </label>
          <Textarea
            className="mt-3 min-h-72"
            id="transcript"
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Paste a transcript or transcribe audio first..."
            value={transcript}
          />
          <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button
              className="w-full sm:w-auto"
              disabled={isLoading || transcript.trim().length < 20}
              onClick={onAnalyze}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze meeting
            </Button>
            {transcript.trim().length < 20 ? (
              <span className="text-xs text-slate-500">
                {20 - transcript.trim().length} more characters needed
              </span>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-teal-700" />
          <h2 className="text-lg font-semibold text-slate-950">Results</h2>
        </div>
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
          <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-500">
            Structured notes, decisions, and action items will appear here after
            analysis.
          </div>
        )}
      </div>
    </div>
  );
}
