import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-950">
            Meeting history
          </h1>
          <p className="mt-2 text-slate-600">
            Your analyzed meetings will appear here after the database is
            connected.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            New meeting
          </Link>
        </Button>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
        No meetings yet.
      </div>
    </section>
  );
}
