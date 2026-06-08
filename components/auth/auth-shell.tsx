import Link from "next/link";

export function AuthShell({
  children,
  eyebrow,
  title
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <Link className="text-lg font-semibold text-slate-950" href="/">
            MeetingMind
          </Link>
          <Link className="text-sm font-medium text-slate-600" href="/">
            Back home
          </Link>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-wide text-teal-700">
              {eyebrow}
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              Keep meeting summaries, decisions, and follow-ups attached to the
              right workspace account.
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">{children}</div>
        </div>
      </section>
    </main>
  );
}
