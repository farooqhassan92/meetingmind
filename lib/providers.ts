export function getProvider(name: string) {
  return (process.env[name] ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
}

export function isHostedRuntime() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

export function shouldUseGroqForAi() {
  return getProvider("AI_PROVIDER") === "groq" || (
    isHostedRuntime() && Boolean(process.env.GROQ_API_KEY)
  );
}

export function shouldUseGroqForTranscription() {
  return getProvider("TRANSCRIPTION_PROVIDER") === "groq" || (
    isHostedRuntime() && Boolean(process.env.GROQ_API_KEY)
  );
}
