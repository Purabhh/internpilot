# intern.pilot

Personal job-application tracker.

## Setup

```bash
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY
npm run dev
```

## Scripts

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run test` — run tests (Vitest)
- `npm run typecheck` — run TypeScript without emit

## Stack

Next.js 15 (App Router) · TypeScript · better-sqlite3 + Drizzle · node-cron · googleapis · @anthropic-ai/sdk · Zod · Vitest

See `docs/superpowers/specs/` for the design spec and `docs/superpowers/plans/` for the implementation plan.
