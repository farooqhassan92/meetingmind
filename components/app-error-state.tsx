"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type AppErrorStateProps = {
  description?: string;
  error?: Error & { digest?: string };
  reset?: () => void;
  title: string;
};

function cleanMessage(message: string | undefined) {
  if (!message || message === "An error occurred in the Server Components render.") {
    return null;
  }

  return message;
}

export function AppErrorState({
  description,
  error,
  reset,
  title
}: AppErrorStateProps) {
  const message = cleanMessage(error?.message) ?? description;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          {message ??
            "Something went wrong. Please try again, or return to the dashboard."}
        </p>
        {error?.digest ? (
          <p className="mt-3 text-xs text-slate-400">
            Error reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {reset ? (
            <Button onClick={reset} type="button">
              <RefreshCcw className="h-4 w-4" />
              Try again
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
