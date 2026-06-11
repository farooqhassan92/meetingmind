import { auth } from "@clerk/nextjs/server";
import { CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

import { acceptInvitationAction } from "./actions";

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { userId } = await auth();
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: {
      organization: true,
      team: true
    }
  });

  if (!invitation) {
    notFound();
  }

  const isExpired = invitation.expiresAt < new Date();

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Mail className="h-5 w-5 text-teal-700" />
            <h1 className="text-2xl font-semibold text-slate-950">
              Organization invite
            </h1>
          </div>
          <p className="mt-4 leading-7 text-slate-600">
            You have been invited to join{" "}
            <span className="font-medium text-slate-950">
              {invitation.organization.name}
            </span>
            .
          </p>
          <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              Organization role:{" "}
              <span className="font-medium text-slate-950">
                {invitation.organizationRole}
              </span>
            </p>
            {invitation.team ? (
              <p className="mt-1">
                Team:{" "}
                <span className="font-medium text-slate-950">
                  {invitation.team.name}
                </span>{" "}
                as{" "}
                <span className="font-medium text-slate-950">
                  {invitation.teamRole}
                </span>
              </p>
            ) : null}
          </div>

          {invitation.acceptedAt ? (
            <Button asChild className="mt-5 w-full sm:w-auto">
              <Link href="/dashboard">
                <CheckCircle2 className="h-4 w-4" />
                Go to dashboard
              </Link>
            </Button>
          ) : isExpired ? (
            <p className="mt-5 text-sm text-red-600">
              This invitation has expired. Ask for a new invite.
            </p>
          ) : userId ? (
            <form action={acceptInvitationAction} className="mt-5">
              <input name="token" type="hidden" value={token} />
              <Button className="w-full sm:w-auto" type="submit">
                <CheckCircle2 className="h-4 w-4" />
                Accept invite
              </Button>
            </form>
          ) : (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-slate-600">
                Sign in with {invitation.email}, then return to this invite.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link href={"/sign-in" as Route}>Sign in</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
