"use client";

import { AppErrorState } from "@/components/app-error-state";

export default function InviteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorState
      description="We could not accept this invitation. The invite may be expired, cancelled, or tied to a different email address."
      error={error}
      reset={reset}
      title="Invite could not be accepted"
    />
  );
}
