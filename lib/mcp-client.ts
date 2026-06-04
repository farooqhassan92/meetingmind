import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type { MeetingAnalysis } from "@/mcp-server/src/llm/schemas";

type TranscribeInput = {
  audioBase64: string;
  fileName: string;
  mimeType: string;
};

let clientPromise: Promise<Client> | null = null;

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
  const client = await getMcpClient();
  const result = await client.callTool({
    name: "transcribe_audio",
    arguments: input
  });

  return JSON.parse(getTextContent(result)) as { transcript: string };
}

export async function analyzeMeeting(transcript: string) {
  const client = await getMcpClient();
  const result = await client.callTool({
    name: "analyze_meeting",
    arguments: { transcript }
  });

  return JSON.parse(getTextContent(result)) as MeetingAnalysis;
}
