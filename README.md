# MeetingMind

MeetingMind is a Next.js app for turning meeting audio or transcripts into
shared, searchable meeting intelligence. It supports organization workspaces,
team-scoped permissions, audio transcription, structured meeting analysis,
action-item tracking, and natural-language search across saved meetings.

## Current Status

The app currently includes:

- Clerk-backed sign-in/sign-up with onboarding for users who still need an
  organization.
- Organization workspaces with CEO and member organization roles, plus manager
  and member team roles.
- Explicit organization invitations with invite links, optional Resend email
  delivery, invite acceptance, resend/cancel flows, and stale invite repair.
- CEO workspace management for organizations, teams, members, invitations, team
  archive/restore, and team assignment.
- Member-facing "My organization" workspace view with accessible teams, recent
  meetings, and assigned action items.
- Meeting creation from pasted transcripts or uploaded audio.
- Audio transcription through the MCP server with a local Whisper command, or
  directly through Groq when configured.
- Meeting analysis through the MCP server with local Ollama, or directly through
  Groq when configured.
- Saved meeting detail pages with summaries, action items, decisions, topics,
  follow-up questions, and transcript storage.
- Cross-meeting action-item workflow with open/completed filters, assignee
  filters, search, completion state, assignment, deadline, and edit controls.
- Meeting history dashboard with organization/team filters, text search, date
  ranges, stats, pagination, and delete support.
- Semantic meeting search over pgvector meeting chunks, including answer mode
  with source notes and raw match mode.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Clerk for authentication
- Prisma with PostgreSQL and pgvector
- MCP server for local AI tools
- Ollama for local analysis, answering, and embeddings
- Local Whisper command or Groq for transcription
- Groq as an optional hosted AI provider
- Resend as optional invite email delivery

## Key Paths

- `app/` - App Router pages and API routes
- `app/dashboard/page.tsx` - meeting history, filters, stats, and AI search
- `app/dashboard/new/page.tsx` - meeting analysis entry point
- `app/dashboard/workspace/` - organization, team, member, and invite management
- `app/dashboard/action-items/` - cross-meeting action-item workflow
- `app/invite/[token]/` - invitation acceptance flow
- `app/api/analyze/route.ts` - transcript analysis and meeting persistence
- `app/api/transcribe/route.ts` - audio transcription endpoint
- `app/api/search/` - semantic search and answer endpoints
- `components/meeting-form.tsx` - audio upload, transcription, and transcript analysis UI
- `components/semantic-search-panel.tsx` - natural-language meeting search UI
- `lib/mcp-client.ts` - Next.js backend client for MCP tools
- `lib/organization-access.ts` - workspace access and permission helpers
- `lib/meeting-chunks.ts` - chunk creation for semantic search
- `mcp-server/src/` - MCP tool server for transcription and analysis
- `prisma/schema.prisma` - data model for users, organizations, teams, meetings,
  chunks, action items, decisions, topics, and follow-up questions

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` with the services you want to run. At minimum, the app needs
database and Clerk configuration for the full authenticated workflow:

```bash
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."

NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
```

Run Prisma migrations:

```bash
npm run prisma:migrate
```

Run the Next.js app:

```bash
npm run dev
```

For the default local AI path, the backend launches the MCP server over stdio
using `MCP_SERVER_COMMAND` and `MCP_SERVER_ARGS`. You can also run the MCP server
directly when debugging tool startup or local AI configuration:

```bash
npm run mcp:dev
```

## AI And Transcription Configuration

Local Ollama is the default analysis, answer, and embedding path.

```bash
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2:3b"
EMBEDDING_MODEL="nomic-embed-text"
```

For local transcription through the MCP server, configure a Whisper-compatible
command and make sure `ffmpeg` is available on `PATH`:

```bash
LOCAL_WHISPER_COMMAND="whisper"
LOCAL_WHISPER_ARGS="--model base --language en --output_format txt {input}"
```

For hosted AI/transcription with Groq:

```bash
AI_PROVIDER="groq"
TRANSCRIPTION_PROVIDER="groq"
GROQ_API_KEY="..."
GROQ_MODEL="llama-3.1-8b-instant"
GROQ_TRANSCRIPTION_MODEL="whisper-large-v3-turbo"
```

For Gemini embeddings instead of Ollama embeddings:

```bash
EMBEDDING_PROVIDER="gemini"
GEMINI_API_KEY="..."
EMBEDDING_MODEL="gemini-embedding-001"
```

Optional MCP tuning:

```bash
MCP_SERVER_COMMAND="npm"
MCP_SERVER_ARGS="run,mcp:dev"
MCP_ANALYZE_TIMEOUT_MS="180000"
MCP_TRANSCRIBE_TIMEOUT_MS="600000"
```

Optional invite email delivery:

```bash
RESEND_API_KEY="..."
INVITE_FROM_EMAIL="MeetingMind <onboarding@resend.dev>"
```

If `RESEND_API_KEY` is not set, invite links are still created and shown in the
workspace, but email delivery is marked as not configured.

## Database Notes

MeetingMind uses PostgreSQL through Prisma and stores semantic-search embeddings
in a `vector(768)` column. The database must have pgvector available before the
meeting chunk migration can run successfully.

New meeting analyses create:

- a saved meeting record
- action items, decisions, topics, and follow-up questions
- searchable meeting chunks for summary, transcript, action items, decisions,
  topics, and follow-up questions

If older meetings exist without chunks, run:

```bash
npm run chunks:backfill
```

## Development Commands

```bash
npm run dev              # Start the Next.js dev server
npm run mcp:dev          # Start the MCP server directly
npm run lint             # Run ESLint
npm run build            # Build the app
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Run Prisma migrations locally
npm run chunks:backfill  # Backfill semantic-search chunks
```

## Known Local Requirements

- PostgreSQL with pgvector enabled
- Clerk keys for the authenticated dashboard and workspace flows
- Ollama with `llama3.2:3b` and `nomic-embed-text`, unless using Groq/Gemini
  alternatives
- `ffmpeg` on `PATH` for local Whisper transcription
- Windows users may need to stop local Node/Next/MCP processes if Prisma
  generate or migrate fails with a locked engine DLL

Secrets belong in `.env.local`; never commit them.
