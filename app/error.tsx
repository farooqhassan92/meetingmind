"use client";

import { AppErrorState } from "@/components/app-error-state";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorState
      description="We could not load this page. Please try again."
      error={error}
      reset={reset}
      title="Something went wrong"
    />
  );
}
