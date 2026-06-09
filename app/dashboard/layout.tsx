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
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link className="font-semibold text-slate-950" href="/">
            MeetingMind
          </Link>
          <nav className="flex items-center gap-5 text-sm text-slate-600">
            <Link href="/">Home</Link>
            <Link href="/dashboard">History</Link>
            <Link href="/dashboard/new">New meeting</Link>
            {hasClerkKey ? (
              <UserMenu />
            ) : (
              <Link href={{ pathname: "/sign-in" }}>Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
