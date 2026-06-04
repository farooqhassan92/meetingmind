import { ArrowRight, FileAudio, ListChecks, Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const features = [
  { icon: FileAudio, label: "Audio or transcript input" },
  { icon: ListChecks, label: "Action items and decisions" },
  { icon: Search, label: "Searchable meeting history" }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <Link className="text-lg font-semibold text-slate-950" href="/">
            MeetingMind
          </Link>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-teal-700">
              MCP-powered AI notes
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-slate-950">
              MeetingMind
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload a meeting recording or paste a transcript and turn it into
              a clean summary, decisions, follow-up questions, and assigned
              action items.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard/new">
                  Analyze a meeting
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">View history</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              {features.map((feature) => (
                <div
                  className="flex items-center gap-3 rounded-md border border-slate-200 p-4"
                  key={feature.label}
                >
                  <feature.icon className="h-5 w-5 text-teal-700" />
                  <span className="text-sm font-medium text-slate-700">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
