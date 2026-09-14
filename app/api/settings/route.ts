import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import { startSchedulers, runScraperNow, runTrackerNow, runEnrichNow } from "@/lib/jobs/scheduler";
import { heartbeat } from "@/lib/jobs/heartbeat";

const patchSchema = z.object({
  scraperEnabled: z.union([z.literal(0), z.literal(1)]).optional(),
  trackerEnabled: z.union([z.literal(0), z.literal(1)]).optional(),
  enrichEnabled: z.union([z.literal(0), z.literal(1)]).optional(),
  scraperIntervalMin: z.number().int().min(1).max(1440).optional(),
  trackerIntervalMin: z.number().int().min(1).max(1440).optional(),
  enrichIntervalMin: z.number().int().min(1).max(1440).optional(),
});

export async function GET() {
  const db = openDb(dbPath());
  // Heartbeat: if setInterval died (HMR / process restart in dev), fire any
  // overdue ticks now. Fire-and-forget, doesn't block the response.
  heartbeat(db);
  return NextResponse.json(getSettings(db));
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const db = openDb(dbPath());

  // Snapshot before so we can detect off→on transitions and react instantly.
  const before = getSettings(db);
  const updated = updateSettings(db, parsed.data);

  const scraperTurnedOn = parsed.data.scraperEnabled === 1 && before.scraperEnabled === 0;
  const trackerTurnedOn = parsed.data.trackerEnabled === 1 && before.trackerEnabled === 0;
  const enrichTurnedOn = parsed.data.enrichEnabled === 1 && before.enrichEnabled === 0;
  const intervalChanged =
    (parsed.data.scraperIntervalMin !== undefined && parsed.data.scraperIntervalMin !== before.scraperIntervalMin) ||
    (parsed.data.trackerIntervalMin !== undefined && parsed.data.trackerIntervalMin !== before.trackerIntervalMin) ||
    (parsed.data.enrichIntervalMin !== undefined && parsed.data.enrichIntervalMin !== before.enrichIntervalMin);

  // Re-arm the interval timers on ANY enable transition, not just interval
  // changes. The timers live in process memory — a dev-mode hot reload (or any
  // process restart that skips instrumentation) can silently kill them, and
  // before this an off→on toggle fired one immediate tick but never restarted
  // the recurring timer, so polling stopped after that single run.
  // startSchedulers clears existing timers first, so re-calling is safe.
  if (intervalChanged || scraperTurnedOn || trackerTurnedOn || enrichTurnedOn) {
    startSchedulers(db);
  }

  // Off→on: also fire one cycle immediately so the user sees data within
  // seconds instead of waiting out the first interval.
  if (scraperTurnedOn) runScraperNow(db);
  if (trackerTurnedOn) runTrackerNow(db);
  if (enrichTurnedOn) runEnrichNow(db);

  return NextResponse.json(updated);
}
