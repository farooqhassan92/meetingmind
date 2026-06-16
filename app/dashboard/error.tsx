"use client";

import { AppErrorState } from "@/components/app-error-state";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorState
      description="We could not complete that workspace action. Check the details and try again."
      error={error}
      reset={reset}
      title="Dashboard action failed"
    />
  );
}
