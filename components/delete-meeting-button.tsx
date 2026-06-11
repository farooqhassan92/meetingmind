"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function DeleteMeetingButton({
  className,
  meetingId
}: {
  className?: string;
  meetingId: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function onDelete() {
    const confirmed = window.confirm(
      "Delete this meeting and all of its notes? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setIsDeleting(false);
      window.alert("Could not delete this meeting. Please try again.");
    }
  }

  return (
    <Button
      className={className}
      disabled={isDeleting}
      onClick={onDelete}
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
  );
}
