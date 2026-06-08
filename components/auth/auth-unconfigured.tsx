import Link from "next/link";

import { Button } from "@/components/ui/button";

export function AuthUnconfigured() {
  return (
    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">
        Clerk is not configured yet
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Add the Clerk environment variables, restart the dev server, and this
        page will show the sign-in or sign-up form.
      </p>
      <Button asChild className="mt-5" variant="outline">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  );
}
