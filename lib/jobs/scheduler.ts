import cron, { type ScheduledTask } from "node-cron";
import type { DB } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries/settings";
import { tickScraper } from "./scraper-job";
import { tickTracker } from "./tracker-job";

let scraperTask: ScheduledTask | null = null;
let trackerTask: ScheduledTask | null = null;

export function startSchedulers(db: DB): void {
  const settings = getSettings(db);
  scraperTask?.stop();
  trackerTask?.stop();
  scraperTask = cron.schedule(`*/${settings.scraperIntervalMin} * * * *`, () => void tickScraper(db));
  trackerTask = cron.schedule(`*/${settings.trackerIntervalMin} * * * *`, () => void tickTracker(db));
}

export function stopSchedulers(): void {
  scraperTask?.stop();
  trackerTask?.stop();
  scraperTask = null;
  trackerTask = null;
}
