import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { transcribeAudio } from "@/lib/mcp-client";

const requestSchema = z.object({
  audioBase64: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1)
});

export async function POST(request: Request) {
  const hasClerkConfig = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  if (hasClerkConfig) {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = requestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "Audio payload is required." },
      { status: 400 }
    );
  }

  try {
    const transcription = await transcribeAudio(body.data);

    return NextResponse.json(transcription);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Audio transcription failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
