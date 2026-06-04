import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  analyzeMeetingInputSchema,
  analyzeMeetingTool
} from "./tools/analyze";
import {
  transcribeAudioInputSchema,
  transcribeAudioTool
} from "./tools/transcribe";

const server = new McpServer({
  name: "meetingmind-mcp-server",
  version: "0.1.0"
});

server.registerTool(
  "transcribe_audio",
  {
    title: "Transcribe audio",
    description: "Transcribe a base64-encoded audio file with Whisper.",
    inputSchema: transcribeAudioInputSchema.shape
  },
  async (input) => {
    const parsed = transcribeAudioInputSchema.parse(input);
    const result = await transcribeAudioTool(parsed);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    };
  }
);

server.registerTool(
  "analyze_meeting",
  {
    title: "Analyze meeting",
    description: "Extract structured notes from a meeting transcript.",
    inputSchema: analyzeMeetingInputSchema.shape
  },
  async (input) => {
    const parsed = analyzeMeetingInputSchema.parse(input);
    const result = await analyzeMeetingTool(parsed);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
