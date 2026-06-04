import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

export const transcribeAudioInputSchema = z.object({
  audioBase64: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1)
});

export async function transcribeAudioTool(
  input: z.infer<typeof transcribeAudioInputSchema>
) {
  const command = process.env.LOCAL_WHISPER_COMMAND;

  if (!command) {
    throw new Error(
      "Audio transcription is configured for free local tools. Set LOCAL_WHISPER_COMMAND or paste a transcript instead."
    );
  }

  const workDir = join(tmpdir(), `meetingmind-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const inputPath = join(workDir, input.fileName);
  const outputPath = join(workDir, "transcript.txt");

  try {
    await writeFile(inputPath, Buffer.from(input.audioBase64, "base64"));
    const configuredArgs = (process.env.LOCAL_WHISPER_ARGS ?? "")
      .split(" ")
      .map((arg) => arg.trim())
      .filter(Boolean);

    const args = configuredArgs.map((arg) =>
      arg.replace("{input}", inputPath).replace("{output}", outputPath)
    );

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr || `Local Whisper exited with code ${code}.`));
      });
    });

    const transcript = await readFile(outputPath, "utf8");

    return {
      transcript: transcript.trim()
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
