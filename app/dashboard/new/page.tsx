import { auth, currentUser } from "@clerk/nextjs/server";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { MeetingForm } from "@/components/meeting-form";
import {
  ensureAppUser,
  getCreatableTeams,
  getUserMeetingAccess
} from "@/lib/organization-access";

export default async function NewMeetingPage() {
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
  if (!access || access.memberships.length === 0) {
    redirect("/onboarding" as Route);
  }
  const creatableTeamIds = new Set(
    getCreatableTeams(access).map((team) => team.id)
  );
  const organizations =
    access.organizations
      .map((organization) => ({
      id: organization.id,
      name: organization.name,
      teams: organization.teams
        .filter((team) => creatableTeamIds.has(team.id))
        .map((team) => ({
          id: team.id,
          name: team.name
        }))
    }))
      .filter((organization) => organization.teams.length > 0);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">
          Analyze a meeting
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Upload an audio recording to transcribe it, or paste a transcript
          directly.
        </p>
      </div>
      <MeetingForm organizations={organizations} />
    </section>
  );
}
