import { MeetingForm } from "@/components/meeting-form";

export default function NewMeetingPage() {
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
      <MeetingForm />
    </section>
  );
}
