import { auth, currentUser } from "@clerk/nextjs/server";
import { ArrowRight, FileAudio, ListChecks, Search } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import {
  ensureAppUser,
  getUserMeetingAccess
} from "@/lib/organization-access";

const features = [
  { icon: FileAudio, label: "Audio or transcript input" },
  { icon: ListChecks, label: "Action items and decisions" },
  { icon: Search, label: "Searchable meeting history" }
];

export default async function HomePage() {
  const hasClerkConfig = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );
  const { userId } = hasClerkConfig ? await auth() : { userId: null };

  if (userId) {
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
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <Link className="text-lg font-semibold text-slate-950" href="/">
            MeetingMind
          </Link>
          <div className="flex items-center gap-3">
            {userId ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <UserMenu />
              </>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link href={{ pathname: "/sign-in" }}>Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href={{ pathname: "/sign-up" }}>Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-teal-700">
              MCP-powered AI notes
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-slate-950">
              MeetingMind
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Upload a meeting recording or paste a transcript and turn it into
              a clean summary, decisions, follow-up questions, and assigned
              action items.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard/new">
                  Analyze a meeting
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">View history</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              {features.map((feature) => (
                <div
                  className="flex items-center gap-3 rounded-md border border-slate-200 p-4"
                  key={feature.label}
                >
                  <feature.icon className="h-5 w-5 text-teal-700" />
                  <span className="text-sm font-medium text-slate-700">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
