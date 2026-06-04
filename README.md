# MeetingMind

MeetingMind turns meeting recordings or transcripts into structured notes: summaries, action items, decisions, topics, and follow-up questions.

The Next.js backend talks to an MCP server for all AI work. The backend saves meeting data directly through Prisma.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run the MCP server separately during local development:

```bash
npm run mcp:dev
```

## Architecture

- `app/` contains the Next.js App Router UI and API routes.
- `lib/mcp-client.ts` connects backend routes to the MCP server.
- `mcp-server/` registers the `transcribe_audio` and `analyze_meeting` tools.
- `prisma/schema.prisma` models users, meetings, action items, decisions, topics, and follow-up questions.

Secrets belong in `.env.local`; never commit them.
