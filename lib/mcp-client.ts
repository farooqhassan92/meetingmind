import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  analyzeTranscriptWithGroq,
  transcribeAudioWithGroq
} from "@/lib/groq";
import type { MeetingAnalysis } from "@/mcp-server/src/llm/schemas";

type TranscribeInput = {
  audioBase64: string;
  fileName: string;
  mimeType: string;
};

const DEFAULT_ANALYZE_TIMEOUT_MS = 180_000;
const DEFAULT_TRANSCRIBE_TIMEOUT_MS = 600_000;

let clientPromise: Promise<Client> | null = null;

function getTimeoutMs(envName: string, fallback: number) {
  const configured = Number(process.env[envName]);

  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

function getTextContent(result: unknown) {
  if (
    typeof result !== "object" ||
    result === null ||
    !("content" in result) ||
    !Array.isArray(result.content)
  ) {
    throw new Error("MCP returned an unexpected response.");
  }

  const content = result.content[0];
  if (
    typeof content !== "object" ||
    content === null ||
    !("type" in content) ||
    !("text" in content) ||
    content.type !== "text" ||
    typeof content.text !== "string"
  ) {
    throw new Error("MCP returned an unexpected content block.");
  }

  return content.text;
}

function isToolError(result: unknown) {
  return (
    typeof result === "object" &&
    result !== null &&
    "isError" in result &&
    result.isError === true
  );
}

function parseToolJson<T>(result: unknown) {
  const text = getTextContent(result);

  if (isToolError(result)) {
    throw new Error(text);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || "MCP returned invalid JSON.");
  }
}

async function createClient() {
  const command = process.env.MCP_SERVER_COMMAND ?? "npm";
  const args = (process.env.MCP_SERVER_ARGS ?? "run,mcp:dev")
    .split(",")
    .map((arg) => arg.trim())
    .filter(Boolean);

  const transport = new StdioClientTransport({ command, args });
  const client = new Client({
    name: "meetingmind-backend",
    version: "0.1.0"
  });

  await client.connect(transport);
  return client;
}

export function getMcpClient() {
  clientPromise ??= createClient();
  return clientPromise;
}

export async function transcribeAudio(input: TranscribeInput) {
  if (process.env.TRANSCRIPTION_PROVIDER === "groq") {
    return transcribeAudioWithGroq(input);
  }

  const client = await getMcpClient();
  const result = await client.callTool(
    {
      name: "transcribe_audio",
      arguments: input
    },
    undefined,
    {
      timeout: getTimeoutMs(
        "MCP_TRANSCRIBE_TIMEOUT_MS",
        DEFAULT_TRANSCRIBE_TIMEOUT_MS
      )
    }
  );

  return parseToolJson<{ transcript: string }>(result);
}

export async function analyzeMeeting(transcript: string) {
  if (process.env.AI_PROVIDER === "groq") {
    return analyzeTranscriptWithGroq(transcript);
  }

  const client = await getMcpClient();
  const result = await client.callTool(
    {
      name: "analyze_meeting",
      arguments: { transcript }
    },
    undefined,
    {
      timeout: getTimeoutMs(
        "MCP_ANALYZE_TIMEOUT_MS",
        DEFAULT_ANALYZE_TIMEOUT_MS
      )
    }
  );

  return parseToolJson<MeetingAnalysis>(result);
}
