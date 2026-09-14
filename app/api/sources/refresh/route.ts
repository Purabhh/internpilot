import { NextResponse } from "next/server";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { runScrapers, type ScrapeSummary } from "@/lib/scrapers";

/**
 * Manual "check all sources now" — the refresh button on the job board.
 *
 * Deliberately bypasses the scraper daemon's on/off toggle and interval:
 * a click is an explicit request, so it should work even when the daemon
 * is paused. Concurrent calls are coalesced onto one in-flight run (same
 * idea as heartbeat's inflight flags) so a double-click or two open tabs
 * can't hammer every upstream source twice.
 */
let inflight: Promise<ScrapeSummary> | null = null;

export async function POST() {
  const started = Date.now();
  if (!inflight) {
    const db = openDb(dbPath());
    inflight = runScrapers(db).finally(() => {
      inflight = null;
    });
  }
  const summary = await inflight;
  return NextResponse.json({ ...summary, durationMs: Date.now() - started });
}
