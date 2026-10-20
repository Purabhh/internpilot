import type { DB } from "@/lib/db/client";
import { listJobsToEnrich, setJobSalary } from "@/lib/db/queries/jobs";
import { fetchSalary } from "./enricher";
import type { SalaryParse } from "./salary-parse";

/** How many jobs to price per tick, and how many URLs to fetch at once. */
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 8;

export interface EnrichOptions {
  batchSize?: number;
  concurrency?: number;
  /** Injectable fetcher for tests. */
  httpFetch?: typeof fetch;
}

/**
 * One enrichment cycle: pull the oldest-unpriced batch, fetch each posting a
 * few at a time, and write back the result (a real salary or a null "attempted,
 * none found"). Returns how many jobs a salary was actually FOUND for — the
 * signal the UI shows, distinct from "attempted."
 *
 * Every job in the batch gets its salaryEnrichedAt stamped regardless of
 * outcome, so it leaves the queue and won't be re-fetched.
 */
export async function runEnricher(db: DB, opts: EnrichOptions = {}): Promise<number> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const httpFetch = opts.httpFetch ?? fetch;

  const queue = listJobsToEnrich(db, batchSize);
  let found = 0;

  for (let i = 0; i < queue.length; i += concurrency) {
    const slice = queue.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async (job): Promise<{ id: number; salary: SalaryParse | null }> => ({
        id: job.id,
        salary: await fetchSalary(job.url, httpFetch),
      })),
    );
    // better-sqlite3 is synchronous, so write after each concurrent slice
    // resolves rather than racing writes inside the Promise.all.
    for (const r of results) {
      setJobSalary(db, r.id, r.salary);
      if (r.salary) found += 1;
    }
  }

  return found;
}
