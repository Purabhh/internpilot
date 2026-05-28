# intern.pilot

Personal local-only job-application ledger. Pulls open intern + new-grad roles from public GitHub aggregator repos into a reviewable jobs list. You one-click "I applied" to move a job into the tracker. Gmail is polled on a schedule, inbound mail is classified (hybrid rules + Claude Haiku) into application-status updates, and tracker cards auto-move.

Backend only. The UI lives in a separate Next.js project that calls these API routes.

## Stack

Next.js 15 (App Router) · TypeScript · better-sqlite3 + Drizzle · node-cron · googleapis · @anthropic-ai/sdk · Zod · Vitest.

All persistence lives under `~/.internpilot/`:

```
~/.internpilot/
  internpilot.db        SQLite database
  resumes/              uploaded .docx/.pdf
  credentials.json      Google OAuth client (you provide)
  gmail_token.json      Refresh token (auto-managed)
```

## Setup

```bash
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY
```

### Gmail OAuth (one-time, ~10 min)

1. Open https://console.cloud.google.com — create a project.
2. Enable the **Gmail API** for that project.
3. Create an OAuth 2.0 Client ID of type **Desktop app**.
4. Download the credentials JSON and save it as `~/.internpilot/credentials.json`.
5. Start the app: `npm run dev`
6. Browse to http://127.0.0.1:3000/api/auth/gmail → grant `gmail.readonly` → token gets written to `~/.internpilot/gmail_token.json`.

No need to add a redirect URI in Google Cloud — Desktop OAuth clients auto-allow any `http://localhost:*/` callback path.

## Running

- Dev: `npm run dev`
- Prod: `npm run build && npm run start`
- Tests: `npm test`
- Type check: `npm run typecheck`

Both schedulers (`scraper`, `tracker`) start **disabled**. Flip them on via the settings API:

```bash
curl -X PATCH http://127.0.0.1:3000/api/settings \
  -H 'content-type: application/json' \
  -d '{"scraperEnabled":1,"trackerEnabled":1}'
```

(Or via the UI once it's wired up.)

## Auto-start on Windows

Add a Task Scheduler entry that runs `npm start` in this directory at logon. (Or use the dev server during development — schedulers start either way.)

## Sources seeded by default

- `simplify_summer26_offseason` — SimplifyJobs/Summer2026-Internships off-season (Fall/Winter/Spring roles)
- `simplify_newgrad` — SimplifyJobs/New-Grad-Positions (full-time SWE/Quant/PM)
- `vansh_summer27_offseason` — vanshb03/Summer2027-Internships off-season
- `speedyapply_swe26` — stub, disabled by default (their listings are markdown-only, parser deferred)

You can disable/enable any of them individually via `PATCH /api/sources`.

## Architecture notes

- One Next.js process. No separate worker.
- `instrumentation.ts` boots the schedulers on server start.
- Tracker uses a confidence threshold of 0.7 — anything lower lands in a "needs review" inbox.
- Single user, localhost-only, no auth layer.

See `docs/superpowers/specs/` for the full design and `docs/superpowers/plans/` for the implementation plan.
