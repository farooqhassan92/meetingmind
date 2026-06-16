"use client";

import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { readErrorMessage } from "@/lib/client-errors";

export function DeleteMeetingButton({
  className,
  meetingId
}: {
  className?: string;
  meetingId: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function onDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Could not delete this meeting. It may have already been removed or you may not have permission."
          )
        );
      }

      showToast({
        description: "The meeting and its related notes were removed.",
        title: "Meeting deleted",
        variant: "success"
      });
      router.push("/dashboard");
      router.refresh();
    } catch (caught) {
      setIsDeleting(false);
      showToast({
        description:
          caught instanceof Error
            ? caught.message
            : "Could not delete this meeting. Please try again.",
        title: "Delete failed",
        variant: "error"
      });
    }
  }

  return (
    <>
      <Button
        className={className}
        disabled={isDeleting}
        onClick={() => setIsConfirming(true)}
        type="button"
        variant="destructive"
      >
        {isDeleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Delete
      </Button>

      {isConfirming ? (
        <div
          aria-labelledby={`delete-meeting-title-${meetingId}`}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  className="text-lg font-semibold text-slate-950"
                  id={`delete-meeting-title-${meetingId}`}
                >
                  Delete this meeting?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This will permanently remove the meeting, transcript,
                  decisions, action items, and search notes. This action cannot
                  be undone.
                </p>
              </div>
              <button
                aria-label="Close delete confirmation"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                disabled={isDeleting}
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                disabled={isDeleting}
                onClick={() => setIsConfirming(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={isDeleting}
                onClick={() => void onDelete()}
                type="button"
                variant="destructive"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete meeting
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
