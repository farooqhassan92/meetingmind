import { auth, currentUser } from "@clerk/nextjs/server";
import { Building2, Mail, Timer } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ensureAppUser,
  getPendingInvitationsForEmail,
  getUserMeetingAccess
} from "@/lib/organization-access";

import { createOrganizationAction } from "@/app/dashboard/workspace/actions";

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in" as Route);
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;

  if (!email) {
    throw new Error("Signed-in user is missing a primary email address.");
  }

  await ensureAppUser({
    clerkId: userId,
    email,
    name: clerkUser.fullName ?? clerkUser.username ?? null
  });

  const access = await getUserMeetingAccess(userId);

  if (access && access.memberships.length > 0) {
    redirect("/dashboard" as Route);
  }

  const invitations = await getPendingInvitationsForEmail(email);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Welcome to MeetingMind
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">
            Join or create an organization
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Meeting search is organized by company and team. Create a new
            organization if you are setting one up, or accept an invitation from
            your CEO or manager.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-950">
                Create organization
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Start a new workspace and become the CEO for that organization.
            </p>
            <form action={createOrganizationAction} className="mt-4 space-y-3">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="organization-name"
              >
                Organization name
              </label>
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                id="organization-name"
                name="name"
                placeholder="Acme Inc."
                required
              />
              <Button className="w-full sm:w-auto" type="submit">
                <Building2 className="h-4 w-4" />
                Create as CEO
              </Button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-950">
                Invitations
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Accept an invite if your organization already exists.
            </p>
            {invitations.length > 0 ? (
              <div className="mt-4 space-y-3">
                {invitations.map((invitation) => (
                  <div
                    className="rounded-md border border-slate-200 p-3"
                    key={invitation.id}
                  >
                    <p className="text-sm font-medium text-slate-950">
                      {invitation.organization.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Role {invitation.organizationRole}
                      {invitation.team
                        ? ` / ${invitation.team.name} ${invitation.teamRole}`
                        : ""}
                    </p>
                    <Button asChild className="mt-3 w-full sm:w-auto" variant="outline">
                      <Link href={`/invite/${invitation.token}` as Route}>
                        Accept invite
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-600">
                <Timer className="mb-2 h-5 w-5 text-slate-400" />
                No pending invitations were found for {email}. Ask your CEO or
                team manager for an invite link.
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
