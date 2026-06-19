"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { acceptInvitationAction } from "@/app/invite/[token]/actions";
import { Button } from "@/components/ui/button";

export function AutoAcceptInvitation({ token }: { token: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form action={acceptInvitationAction} className="mt-5" ref={formRef}>
      <input name="token" type="hidden" value={token} />
      <Button className="w-full sm:w-auto" type="submit">
        <Loader2 className="h-4 w-4 animate-spin" />
        Accepting invite
      </Button>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Keep this page open while we add you to the organization.
      </p>
    </form>
  );
}
