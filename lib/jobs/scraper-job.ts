import type { DB } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries/settings";
import { runScrapers } from "@/lib/scrapers";

export async function tickScraper(
  db: DB,
  // Promise<unknown>: runScrapers now returns a ScrapeSummary (for the manual
  // refresh button); the daemon tick just ignores it.
  runner: (db: DB) => Promise<unknown> = runScrapers,
): Promise<void> {
  const settings = getSettings(db);
  if (!settings.scraperEnabled) return;
  try {
    await runner(db);
  } catch (err) {
    console.error("[scraper] tick failed:", err);
  }
}
