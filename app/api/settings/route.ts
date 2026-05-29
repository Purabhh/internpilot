import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import { startSchedulers, runScraperNow, runTrackerNow } from "@/lib/jobs/scheduler";

const patchSchema = z.object({
  scraperEnabled: z.union([z.literal(0), z.literal(1)]).optional(),
  trackerEnabled: z.union([z.literal(0), z.literal(1)]).optional(),
  scraperIntervalMin: z.number().int().min(1).max(1440).optional(),
  trackerIntervalMin: z.number().int().min(1).max(1440).optional(),
});

export async function GET() {
  const db = openDb(dbPath());
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

  // If an interval changed, restart the schedulers so the new interval takes effect.
  if (
    (parsed.data.scraperIntervalMin !== undefined && parsed.data.scraperIntervalMin !== before.scraperIntervalMin) ||
    (parsed.data.trackerIntervalMin !== undefined && parsed.data.trackerIntervalMin !== before.trackerIntervalMin)
  ) {
    startSchedulers(db);
  }

  // Off→on for scraper: fire one cycle immediately so the user sees data within seconds.
  if (parsed.data.scraperEnabled === 1 && before.scraperEnabled === 0) {
    runScraperNow(db);
  }
  // Off→on for tracker: same.
  if (parsed.data.trackerEnabled === 1 && before.trackerEnabled === 0) {
    runTrackerNow(db);
  }

  return NextResponse.json(updated);
}
