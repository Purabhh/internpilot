import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { sources } from "@/lib/db/schema";
import { upsertJobs } from "@/lib/db/queries/jobs";
import type { Scraper } from "./base";
import { SimplifyOffSeasonScraper, SimplifyNewGradScraper } from "./github-simplify";
import { VanshOffSeasonScraper } from "./github-vansh";
import { SpeedySweScraper } from "./github-speedy";
import { JobrightScraper } from "./github-jobright";

/** What one full scrape pass did — surfaced by the manual "refresh" button. */
export interface ScrapeSummary {
  /** New job rows inserted across all sources (post-dedup). */
  inserted: number;
  /** Enabled sources that were attempted. */
  ran: number;
  /** Of those, how many threw (their error is stored on the source row). */
  failed: number;
}

export async function runScrapers(db: DB, scrapers?: Scraper[]): Promise<ScrapeSummary> {
  const enabled = db.select().from(sources).where(eq(sources.enabled, 1)).all();
  const byName = new Map<string, { id: number; url: string }>(
    enabled.map((s) => [s.name, { id: s.id, url: s.url }]),
  );
  const list = scrapers ?? buildDefaultScrapers(byName);
  const summary: ScrapeSummary = { inserted: 0, ran: 0, failed: 0 };

  for (const scraper of list) {
    const src = enabled.find((s) => s.name === scraper.name);
    if (!src) continue;
    summary.ran += 1;
    const now = Math.floor(Date.now() / 1000);
    try {
      const items = await scraper.fetchAndNormalize();
      const newCount = upsertJobs(db, scraper.name, items);
      summary.inserted += newCount;
      // Only bump lastInsertedAt when we actually added new rows. That lets the
      // UI distinguish "ran fine but upstream is quiet" from "haven't run."
      const update: Partial<typeof sources.$inferInsert> = {
        lastRunAt: now,
        lastCount: items.length,
        lastInserted: newCount,
        lastError: null,
      };
      if (newCount > 0) update.lastInsertedAt = now;
      db.update(sources).set(update).where(eq(sources.id, src.id)).run();
    } catch (err) {
      summary.failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      db.update(sources)
        .set({ lastRunAt: now, lastError: msg })
        .where(eq(sources.id, src.id))
        .run();
    }
  }
  return summary;
}

function buildDefaultScrapers(byName: Map<string, { id: number; url: string }>): Scraper[] {
  const out: Scraper[] = [];
  const off = byName.get("simplify_summer26_offseason");
  if (off) out.push(new SimplifyOffSeasonScraper(off.url));
  const ng = byName.get("simplify_newgrad");
  if (ng) out.push(new SimplifyNewGradScraper(ng.url));
  const vansh = byName.get("vansh_summer27_offseason");
  if (vansh) out.push(new VanshOffSeasonScraper(vansh.url));
  const speedy = byName.get("speedyapply_swe26");
  if (speedy) out.push(new SpeedySweScraper(speedy.url));
  const jrIntern = byName.get("jobright_swe_internship");
  if (jrIntern) out.push(new JobrightScraper("jobright_swe_internship", jrIntern.url));
  const jrNewGrad = byName.get("jobright_swe_newgrad");
  if (jrNewGrad) out.push(new JobrightScraper("jobright_swe_newgrad", jrNewGrad.url));
  return out;
}
