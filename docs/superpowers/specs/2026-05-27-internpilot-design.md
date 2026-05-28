# intern.pilot — Design Spec

**Date:** 2026-05-27
**Author:** Purabh Singh (with Claude)
**Status:** Draft — pending final approval

## 1. Purpose

A personal, local-only job-application ledger that:

1. Pulls open intern / new-grad roles from public GitHub aggregator repos into a reviewable jobs list.
2. Lets the user one-click "I applied" or "not interested" on each row. Approved jobs become tracked applications.
3. Polls Gmail on a schedule, classifies inbound mail into application-status updates (rejected / screen / interview / offer), and auto-moves tracker cards. Falls back to a "needs review" inbox when the classifier is unsure.
4. Keeps a small vault of resume files with one marked as default for reference.

The system is **not** an auto-applier, scorer, drafter, or cover-letter generator. Those features were explicitly out of scope per user direction.

## 2. Constraints

- **Single user**, runs on user's laptop, binds to `127.0.0.1`.
- **No auth layer** on the API. Trust boundary is the local machine.
- **Tech stack fixed:** Next.js 15 (App Router), TypeScript, better-sqlite3 + Drizzle ORM, node-cron, `googleapis`, `@anthropic-ai/sdk`, Zod, Vitest.
- **Data root:** `~/.internpilot/` (`internpilot.db`, `resumes/`, `credentials.json`, `gmail_token.json`, `.env`).
- **Local-forever runtime.** Tracker pauses while laptop sleeps; this is acceptable.
- **Frontend is out of scope for this spec.** A Claude Code prompt for regenerating the UI is included in Appendix A. The backend exposes a complete REST API so the UI can be rebuilt without backend changes.

## 3. Architecture

One Next.js process. Two background daemons (scraper, tracker) registered via `instrumentation.ts` at boot, scheduled with `node-cron`. All persistence via Drizzle → SQLite.

```
┌───────────────────────────────────────────────────────────┐
│  Next.js · single process · localhost                     │
│                                                           │
│  UI (built later) ◄── API routes (/api/*) ──► Drizzle    │
│                                                  │        │
│                       Schedulers ────────────────┤        │
│                       • scraperJob               │        │
│                       • trackerJob               ▼        │
│                                          SQLite (file)    │
│                                                           │
│  Outbound: github raw, gmail api, anthropic api           │
└───────────────────────────────────────────────────────────┘
```

## 4. Data model

SQLite schema (Drizzle TypeScript types are the source of truth; SQL shown for clarity):

```sql
CREATE TABLE jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source          TEXT NOT NULL,          -- e.g. "simplify_summer26_off"
  source_id       TEXT NOT NULL,          -- unique within source
  company         TEXT NOT NULL,
  role            TEXT NOT NULL,
  location        TEXT,
  url             TEXT NOT NULL,
  posted_at       INTEGER,                -- unix seconds, nullable
  scraped_at      INTEGER NOT NULL,
  dismissed_at    INTEGER,                -- set when user clicks × or ✓
  UNIQUE(source, source_id)
);

CREATE TABLE applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id          INTEGER REFERENCES jobs(id),     -- nullable for manual entries
  company         TEXT NOT NULL,
  role            TEXT NOT NULL,
  location        TEXT,
  url             TEXT,
  status          TEXT NOT NULL,          -- applied|screen|interview|offer|rejected
  notes           TEXT,                   -- freeform, holds sub-states like "OA · Thu"
  applied_at      INTEGER NOT NULL,
  last_email_at   INTEGER,
  resume_id       INTEGER REFERENCES resumes(id)
);

CREATE TABLE resumes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  filename        TEXT NOT NULL,
  path            TEXT NOT NULL,          -- relative to ~/.internpilot/resumes
  mime_type       TEXT NOT NULL,
  uploaded_at     INTEGER NOT NULL,
  used_count      INTEGER NOT NULL DEFAULT 0,
  is_default      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE emails (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_msg_id         TEXT NOT NULL UNIQUE,
  thread_id            TEXT,
  from_addr            TEXT,
  subject              TEXT,
  snippet              TEXT,
  received_at          INTEGER NOT NULL,
  classified_company   TEXT,
  classified_status    TEXT,               -- one of status enum, or NULL
  confidence           REAL,               -- 0.0 - 1.0
  application_id       INTEGER REFERENCES applications(id),
  classifier           TEXT,               -- "rules" | "llm" | "needs_review"
  needs_review         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sources (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  url             TEXT NOT NULL,
  type            TEXT NOT NULL,          -- "github_json" | "github_md_table"
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_run_at     INTEGER,
  last_count      INTEGER,
  last_error      TEXT
);

CREATE TABLE settings (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  scraper_enabled          INTEGER NOT NULL DEFAULT 0,
  tracker_enabled          INTEGER NOT NULL DEFAULT 0,
  scraper_interval_min     INTEGER NOT NULL DEFAULT 60,
  tracker_interval_min     INTEGER NOT NULL DEFAULT 10,
  gmail_connected_at       INTEGER
);
```

Status enum (TypeScript): `'applied' | 'screen' | 'interview' | 'offer' | 'rejected'`.

## 5. Module layout

```
internpilot/
├── app/
│   ├── api/
│   │   ├── jobs/route.ts                   GET (filter, paginate) · POST (paste-URL)
│   │   ├── jobs/[id]/route.ts              PATCH ({action:"applied"|"dismiss"}) · DELETE
│   │   ├── applications/route.ts           GET · POST (manual)
│   │   ├── applications/[id]/route.ts      PATCH · DELETE
│   │   ├── resumes/route.ts                GET · POST (multipart upload)
│   │   ├── resumes/[id]/route.ts           PATCH (rename, set-default) · DELETE
│   │   ├── sources/route.ts                GET · PATCH (per-source toggle)
│   │   ├── settings/route.ts               GET · PATCH (daemon toggles, intervals)
│   │   ├── emails/route.ts                 GET · PATCH (correction)
│   │   ├── overview/route.ts               GET (aggregate stats for dashboard)
│   │   └── auth/gmail/route.ts             GET (start OAuth) · GET /callback
│   └── instrumentation.ts                  Boot hook → schedulers
├── lib/
│   ├── db/
│   │   ├── schema.ts                       Drizzle schema definitions
│   │   ├── client.ts                       DB connection + migration runner
│   │   └── migrations/0001_init.sql
│   ├── scrapers/
│   │   ├── base.ts                         Scraper interface, NormalizedJob type
│   │   ├── github-simplify.ts              SimplifyJobs JSON format
│   │   ├── github-vansh.ts                 vanshb03 JSON format
│   │   ├── github-speedy.ts                speedyapply JSON format
│   │   └── index.ts                        Orchestrator: runs all enabled sources
│   ├── tracker/
│   │   ├── gmail-client.ts                 OAuth + History API fetch
│   │   ├── classifier-rules.ts             Sender domains + keyword templates
│   │   ├── classifier-llm.ts               Anthropic Haiku w/ structured JSON
│   │   ├── matcher.ts                      Email → application name match
│   │   └── pipeline.ts                     fetch → classify → match → write
│   ├── jobs/
│   │   ├── scheduler.ts                    node-cron registration
│   │   ├── scraper-job.ts                  Scheduled task wrapper
│   │   └── tracker-job.ts                  Scheduled task wrapper
│   └── paths.ts                            Home-dir resolution, ensures ~/.internpilot exists
└── tests/                                  Vitest fixtures + specs
```

## 6. Data flows

### 6.1 Scraper cycle

1. Read all `sources` rows where `enabled=1`.
2. For each source, fetch its URL. SimplifyJobs JSON lives at `https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json` (and similar). Parse to array of raw jobs.
3. Normalize to `NormalizedJob { source_id, company, role, location, url, posted_at }`. Filter inactive listings (sources mark these explicitly).
4. Upsert into `jobs` on `(source, source_id)`. New rows get `scraped_at = now`. Existing rows are left untouched (we don't update locations or descriptions retroactively).
5. Update `sources.last_run_at`, `last_count`, clear `last_error`. On exception, write error to `last_error` and continue with the next source.

### 6.2 User actions on jobs tab

- `PATCH /api/jobs/:id { action: "applied" }` → create `applications` row, set `jobs.dismissed_at = now`. Returns the new application.
- `PATCH /api/jobs/:id { action: "dismiss" }` → set `jobs.dismissed_at = now`, no application created.
- `POST /api/jobs { url, company, role, location }` → manually create a job. `source = "manual"`, `source_id = uuid()`.

### 6.3 Tracker cycle

1. Fetch new Gmail messages via History API since last `messages.list` cursor (stored in settings).
2. For each message, run `classifier-rules.ts`:
   - If sender domain in known ATS list (greenhouse.io, lever.co, ashby.com, hackerrank.com, codesignal.com, etc.) → label `OA invite`.
   - If subject matches rejection template (~12 patterns: "we've decided", "won't be moving forward", "unfortunately") → label `rejected`.
   - If body contains Calendly / cal.com / scheduler links → label `interview`.
   - Otherwise → mark `ambiguous`, fall through to LLM.
3. For ambiguous messages, send to Claude Haiku with structured JSON prompt: `{ company, status, confidence, reasoning }`. Cap parallel LLM calls at 3.
4. Run `matcher.ts`: normalize `classified_company` (lowercase, strip "Inc"/"LLC", collapse whitespace), match against open applications. Tie-break to most recent. No match → leave `application_id` null, set `needs_review=1`.
5. If matched AND `confidence >= 0.7`: update `applications.status` and `last_email_at`. Otherwise: store email row only.
6. Persist all email rows regardless of match outcome — this is the audit log and the "needs review" inbox.

## 7. Error handling

| Failure mode | Behavior |
|---|---|
| Scraper network/parse error | Write to `sources.last_error`, continue other sources |
| Gmail rate limit (429) | Exponential backoff (2, 4, 8s). 3 consecutive failures → `settings.tracker_enabled` stays on but UI shows `degraded` flag |
| Anthropic API error | Skip LLM step for that email; email gets `classifier='needs_review'` |
| OAuth refresh failure | Null out `settings.gmail_connected_at`; UI surfaces reconnect prompt |
| SQLite write contention | Driver queues (better-sqlite3 is sync); not a concern at this scale |
| Resume upload not .docx/.pdf | 400 response, no file written |
| Resume upload > 10MB | 413 response, no file written |
| Source URL returns 404 | `last_error = "404"`, source remains enabled (transient errors are common) |
| LLM returns malformed JSON | One retry, then mark `needs_review` |

## 8. Boot sequence

1. `next start` (or `next dev`)
2. `instrumentation.ts` fires
3. Ensure `~/.internpilot/` and subdirs exist
4. Open `internpilot.db`, run any pending migrations
5. If `sources` table empty: seed with the 4 GitHub sources (see §10)
6. If `settings` row missing: create with both daemons **off** (user must explicitly enable)
7. Register cron jobs from `lib/jobs/scheduler.ts`
8. Each job, on tick, checks its enabled flag before doing work
9. Server ready

## 9. Testing strategy

- **Vitest** as runner.
- **Classifiers**: fixture emails covering known rejection templates, OA invites, scheduler links, ambiguous recruiter chat. Snapshot tests for stability.
- **Scrapers**: HTTP fixtures (saved JSON from each source URL) → assert normalized output. Re-fetched fresh quarterly.
- **Matcher**: fuzzy match unit tests (Citadel vs "Citadel Securities" vs "citadel.com").
- **API routes**: tested with a fresh in-memory SQLite per test, fixture seeding, request → JSON assertion.
- **Boot test**: instrumentation hook → scheduler registers → first tick fires.
- **No E2E** (no UI yet).

## 10. Seed data

Sources to seed on first boot:

| name | url | type |
|---|---|---|
| `simplify_summer26_offseason` | `raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json` | github_json |
| `simplify_newgrad` | `raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json` | github_json |
| `vansh_summer27_offseason` | `raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json` | github_json |
| `speedyapply_swe26` | `raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/listings.json` | github_json |

**Off-season filtering:** SimplifyJobs and vanshb03 ship a single `listings.json` containing both main-season (Summer) and off-season (Fall/Winter/Spring) roles. Each listing has a `terms` field (array of strings like `["Summer 2026"]` or `["Fall 2026", "Winter 2027"]`). The `*_offseason` scrapers filter to listings whose `terms` exclude "Summer". The `simplify_newgrad` scraper applies no term filter. The exact JSON field name (`terms` vs `season` vs `category`) must be verified by hitting the live URL during the scraper-impl task; spec will be updated if different.

**HTTP etiquette:** All GitHub raw fetches use a custom `User-Agent: internpilot/0.1 (personal)` header. No auth needed for raw URLs. 60-second timeout per fetch.

## 11. Open items deferred

These are explicitly **not** in this spec, can be added later:

- Per-company direct ATS polling (Greenhouse / Lever / Ashby boards).
- Auto-extracting company/role/location from pasted URLs.
- Browser extension for one-click "save this job".
- Mobile-accessible UI (would require dropping the localhost binding).
- Multi-user support.
- Cover-letter drafting, AI scoring, application auto-submission.

## Appendix A — Claude Code prompt for UI regeneration

To be used in a new Next.js project that calls the API in this spec. Brutalist editorial / technical-zine theme matching the original mockup. Saved verbatim from the brainstorming session — drop into Claude Code along with the OpenAPI export (auto-generated from the Zod schemas).

```
Build a Next.js 15 (App Router) frontend for "intern.pilot" — a personal
job-application tracker.

Visual: brutalist editorial / technical-zine.
Colors: cream #F4F0E6 bg · hot pink #FF1F6E primary · electric blue #2E5BFF
secondary · near-black #0A0A0A text · sticky-note yellow #F4D951 for callouts.
Typography: ABC Diatype Black or Inter Black (display, lowercase, -2% tracking)
+ Inter (body) + IBM Plex Mono (data, timers, file paths).
Cards: 2px solid black border, hard offset shadow 4px 4px 0 #000, sharp corners.
Decoration: hand-drawn wavy SVG underlines under italic words, blue pentagon
SVG accents, rotated "+ NEW" / "★ DEFAULT" sticky tags.
Top-right HUD: pulsing blue "cycle N · live" badge + mono "T+ HH:MM:SS" timer
counting from app boot.

Pages:
  /overview  — editorial headline pulled from /api/overview, stats grid,
               big scraper + tracker toggle switches w/ last-run/next-run,
               match queue right rail, funnel bar chart.
  /jobs      — table: company/role, location, source badge, actions ✓ × →.
               Filter chips + search. Right rail: per-source on/off toggles.
  /tracker   — 5-column kanban: Applied / Screen / Interview / Offer / Rejected.
               Offer column gets hot-pink fill. Cards show recruiter, days,
               sub-step note. Drag between columns for manual override.
  /resumes   — grid of cards w/ № mono, title, filename, upload date, used N×.
               Default card has pink fill + ★ DEFAULT tag. Upload form on top.
  /emails    — list of classified inbound emails: from, subject, detected
               company, detected status, confidence. Click to expand.
               "Fix" button POSTs correction to /api/emails/:id.

API contract: attached separately (Zod schemas → OpenAPI). All paths under /api.

Strict requirements:
  • Hard-edge shadows only (no blur radius)
  • Wavy underline = SVG path, hand-drawn feel, NOT text-decoration
  • Live pulse dot must actually pulse via CSS animation
  • T+ timer updates every second via setInterval
  • shadcn/ui base, heavily restyled to match — do not ship default shadcn look
  • React Query for server state; no Redux/Zustand
```

## Appendix B — Gmail OAuth setup checklist

User-provided. Standard Google Cloud Console flow:
1. Create project at console.cloud.google.com
2. Enable Gmail API
3. Create OAuth 2.0 Client ID (type: Desktop app)
4. Download credentials.json → `~/.internpilot/credentials.json`
5. First app launch → browser opens → grant `gmail.readonly` scope → `gmail_token.json` written
