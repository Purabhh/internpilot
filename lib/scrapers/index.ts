import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { sources } from "@/lib/db/schema";
import { upsertJobs } from "@/lib/db/queries/jobs";
import type { Scraper } from "./base";
import { SimplifyOffSeasonScraper, SimplifyNewGradScraper } from "./github-simplify";
import { VanshOffSeasonScraper } from "./github-vansh";
import { SpeedySweScraper } from "./github-speedy";

export async function runScrapers(db: DB, scrapers?: Scraper[]): Promise<void> {
  const enabled = db.select().from(sources).where(eq(sources.enabled, 1)).all();
  const byName = new Map<string, { id: number; url: string }>(
    enabled.map((s) => [s.name, { id: s.id, url: s.url }]),
  );
  const list = scrapers ?? buildDefaultScrapers(byName);

  for (const scraper of list) {
    const src = enabled.find((s) => s.name === scraper.name);
    if (!src) continue;
    const now = Math.floor(Date.now() / 1000);
    try {
      const items = await scraper.fetchAndNormalize();
      upsertJobs(db, scraper.name, items);
      db.update(sources)
        .set({ lastRunAt: now, lastCount: items.length, lastError: null })
        .where(eq(sources.id, src.id))
        .run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      db.update(sources)
        .set({ lastRunAt: now, lastError: msg })
        .where(eq(sources.id, src.id))
        .run();
    }
  }
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
  return out;
}
