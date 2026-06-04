import { MeetingForm } from "@/components/meeting-form";

export default function NewMeetingPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">
          Analyze a meeting
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Paste a transcript now, or connect UploadThing for audio uploads in
          the next step.
        </p>
      </div>
      <MeetingForm />
    </section>
  );
}
