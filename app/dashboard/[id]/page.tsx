export default async function MeetingDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold text-slate-950">Meeting details</h1>
      <p className="text-slate-600">
        Meeting <span className="font-mono text-slate-950">{id}</span> will load
        from Prisma once persistence is wired.
      </p>
    </section>
  );
}
