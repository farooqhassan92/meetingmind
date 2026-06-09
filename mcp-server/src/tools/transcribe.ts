import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";

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

  const inputExtension = extname(input.fileName) || ".audio";
  const inputPath = join(workDir, `audio${inputExtension}`);
  const outputPath = join(workDir, "transcript.txt");
  const inputTranscriptPath = join(workDir, "audio.txt");

  try {
    await writeFile(inputPath, Buffer.from(input.audioBase64, "base64"));
    const configuredArgs = (process.env.LOCAL_WHISPER_ARGS ?? "")
      .split(" ")
      .map((arg) => arg.trim())
      .filter(Boolean);

    const args = configuredArgs.map((arg) =>
      arg
        .replace("{input}", inputPath)
        .replace("{output}", outputPath)
        .replace("{outputDir}", workDir)
    );

    const { stdout } = await new Promise<{ stdout: string }>(
      (resolve, reject) => {
        const child = spawn(command, args, {
          cwd: workDir,
          shell: true,
          stdio: ["ignore", "pipe", "pipe"]
        });

        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
          stderr += String(chunk);
        });

        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) {
            resolve({ stdout });
            return;
          }

          if (stderr.includes("FileNotFoundError")) {
            reject(
              new Error(
                "Local Whisper could not read the audio file. Install ffmpeg and make sure ffmpeg is available on PATH, then restart the dev server."
              )
            );
            return;
          }

          reject(
            new Error(stderr || `Local Whisper exited with code ${code}.`)
          );
        });
      }
    );

    const transcript = await readTranscriptOutput(
      [outputPath, inputTranscriptPath],
      stdout
    );

    return {
      transcript: transcript.trim()
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function readTranscriptOutput(preferredPaths: string[], stdout: string) {
  for (const path of preferredPaths) {
    try {
      return await readFile(path, "utf8");
    } catch {
      // Try the next known output pattern.
    }
  }

  const outputDir = dirname(preferredPaths[0]);
  const txtFiles = (await readdir(outputDir).catch(() => [])).filter((file) =>
    file.toLowerCase().endsWith(".txt")
  );

  for (const file of txtFiles) {
    const content = await readFile(join(outputDir, file), "utf8");

    if (content.trim()) {
      return content;
    }
  }

  const stdoutTranscript = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("[") &&
        !line.toLowerCase().includes("detected language")
    )
    .join("\n");

  if (stdoutTranscript) {
    return stdoutTranscript;
  }

  const generatedFiles = await readdir(outputDir).catch(() => []);

  throw new Error(
    `Local Whisper completed, but no transcript text file was found. Generated files: ${
      generatedFiles.join(", ") || "none"
    }.`
  );
}
