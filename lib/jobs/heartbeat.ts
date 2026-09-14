import type { DB } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries/settings";
import { sources } from "@/lib/db/schema";
import { tickTracker } from "./tracker-job";
import { tickScraper } from "./scraper-job";
import { tickEnrich } from "./enrich-job";

/**
 * Heartbeat-on-request: defense in depth against setInterval dying.
 *
 * The scheduler's setInterval timers live inside the Node process. In Next.js
 * dev mode (Turbopack HMR, file-watcher restarts) those timers can quietly
 * disappear after a hot-reload — the new process re-runs `instrumentation.ts`
 * fine, but a timer armed by the *previous* process is gone, and any future
 * timer set in the new one can get clobbered by the next reload. The result
 * is a tracker that says "running" but never actually ticks.
 *
 * This helper closes the gap. Call it from any API handler the UI already
 * polls (e.g. GET /api/settings, which React Query refetches on every page).
 * Each call inspects last-run timestamps and fires the relevant tick if
 * overdue. Fire-and-forget — never blocks the response. Idempotent via
 * in-memory inflight flags so concurrent API hits can't double-tick.
 *
 * In production / a stable process where setInterval works fine, this is
 * just a cheap no-op (timestamps will be fresh, due=false).
 */
const inflight: { tracker: boolean; scraper: boolean; enrich: boolean } = {
  tracker: false,
  scraper: false,
  enrich: false,
};

export function heartbeat(db: DB): void {
  const s = getSettings(db);
  const now = Math.floor(Date.now() / 1000);

  // Tracker — uses settings.trackerLastRunAt as the single source of truth.
  if (s.trackerEnabled && s.gmailConnectedAt && !inflight.tracker) {
    const due =
      !s.trackerLastRunAt ||
      now - s.trackerLastRunAt >= s.trackerIntervalMin * 60;
    if (due) {
      inflight.tracker = true;
      void tickTracker(db).finally(() => {
        inflight.tracker = false;
      });
    }
  }

  // Scraper — last-run is the max of source.lastRunAt (4 rows, JS reduce is fine).
  if (s.scraperEnabled && !inflight.scraper) {
    const rows = db.select().from(sources).all();
    const maxLast = rows.reduce<number>((acc, r) => Math.max(acc, r.lastRunAt ?? 0), 0);
    const due = maxLast === 0 || now - maxLast >= s.scraperIntervalMin * 60;
    if (due) {
      inflight.scraper = true;
      void tickScraper(db).finally(() => {
        inflight.scraper = false;
      });
    }
  }

  // Enricher — uses settings.enrichLastRunAt, same shape as the tracker.
  if (s.enrichEnabled && !inflight.enrich) {
    const due =
      !s.enrichLastRunAt ||
      now - s.enrichLastRunAt >= s.enrichIntervalMin * 60;
    if (due) {
      inflight.enrich = true;
      void tickEnrich(db).finally(() => {
        inflight.enrich = false;
      });
    }
  }
}
