import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

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
            <Link href="/dashboard">History</Link>
            <Link href="/dashboard/new">New meeting</Link>
            {hasClerkKey ? (
              <UserButton />
            ) : (
              <span className="rounded-md border border-slate-200 px-3 py-1 text-slate-500">
                Local
              </span>
            )}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </main>
  );
}
