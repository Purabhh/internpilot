import type { DB } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries/settings";
import { tickScraper } from "./scraper-job";
import { tickTracker } from "./tracker-job";

// Use setInterval rather than node-cron. Cron's `*/N * * * *` is calendar-based
// (fires at :00, :N, :2N…), so flipping the toggle at :42 with a 60-min interval
// would wait until the next hour. setInterval fires N minutes from when it
// starts, which matches user expectation.
let scraperTimer: NodeJS.Timeout | null = null;
let trackerTimer: NodeJS.Timeout | null = null;

export function startSchedulers(db: DB): void {
  const settings = getSettings(db);
  if (scraperTimer) clearInterval(scraperTimer);
  if (trackerTimer) clearInterval(trackerTimer);
  scraperTimer = setInterval(() => void tickScraper(db), settings.scraperIntervalMin * 60_000);
  trackerTimer = setInterval(() => void tickTracker(db), settings.trackerIntervalMin * 60_000);
}

export function stopSchedulers(): void {
  if (scraperTimer) clearInterval(scraperTimer);
  if (trackerTimer) clearInterval(trackerTimer);
  scraperTimer = null;
  trackerTimer = null;
}

// Fire immediately when called from the settings PATCH endpoint after a toggle
// goes from off to on, so the user sees data within seconds instead of waiting
// for the next interval tick.
export function runScraperNow(db: DB): void {
  void tickScraper(db);
}

export function runTrackerNow(db: DB): void {
  void tickTracker(db);
}
