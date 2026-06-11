import Link from "next/link";

import { UserMenu } from "@/components/auth/user-menu";

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link className="text-lg font-semibold text-slate-950" href="/">
            MeetingMind
          </Link>
          <nav className="flex w-full flex-wrap items-center gap-2 text-sm text-slate-600 sm:w-auto">
            <Link className="rounded-md px-3 py-2 hover:bg-slate-100" href="/">
              Home
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-slate-100"
              href="/dashboard"
            >
              History
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-slate-100"
              href="/dashboard/new"
            >
              New meeting
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-slate-100"
              href="/dashboard/workspace"
            >
              Workspace
            </Link>
            {hasClerkKey ? (
              <UserMenu />
            ) : (
              <Link href={{ pathname: "/sign-in" }}>Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </main>
  );
}
