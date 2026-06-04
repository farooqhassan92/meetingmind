import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeMeeting } from "@/lib/mcp-client";

const requestSchema = z.object({
  transcript: z.string().min(20)
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = requestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "Transcript must be at least 20 characters." },
      { status: 400 }
    );
  }

  const analysis = await analyzeMeeting(body.data.transcript);

  return NextResponse.json({ analysis });
}
