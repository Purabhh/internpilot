import type { DB } from "@/lib/db/client";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import { runEnricher } from "@/lib/enrich";

/**
 * Runs one salary-enrichment cycle: price a batch of un-enriched jobs by
 * fetching their posting pages. Gated by settings.enrichEnabled like the other
 * daemons. Stamps enrichLastRunAt / enrichLastCount / enrichLastError so the
 * Overview toggle can show a real "LAST: 2m ago · +5" signal (+N = salaries
 * found this tick, not jobs attempted).
 */
export async function tickEnrich(
  db: DB,
  runner: (db: DB) => Promise<number> = runEnricher,
): Promise<void> {
  const settings = getSettings(db);
  if (!settings.enrichEnabled) return;

  const now = Math.floor(Date.now() / 1000);
  try {
    const found = await runner(db);
    updateSettings(db, {
      enrichLastRunAt: now,
      enrichLastCount: found,
      enrichLastError: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[enrich] tick failed:", msg);
    updateSettings(db, {
      enrichLastRunAt: now,
      enrichLastError: msg.slice(0, 200),
    });
  }
}
