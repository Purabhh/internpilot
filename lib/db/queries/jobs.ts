import { and, count, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { jobs, type Job, type NewJob } from "@/lib/db/schema";
import type { NormalizedJob } from "@/lib/scrapers/base";

export type TermBucket = "summer" | "fall" | "winter" | "spring" | "newgrad";

/**
 * Upserts scraped rows and returns the count of TRULY new rows inserted.
 *
 * Earlier this used `onConflictDoUpdate` and called every row "inserted"
 * because SQLite reports `changes=1` for both true inserts and conflict
 * updates. That made the source-health UI claim work was happening every run
 * even when upstream had nothing new. We now split into two cheap statements:
 *
 *   1. INSERT ... ON CONFLICT DO NOTHING → `changes` is only 1 on a real new row
 *   2. UPDATE terms WHERE (source, sourceId) → only fires for existing rows,
 *      so backfill still works when an upstream tags a previously-untagged row
 *
 * Other columns (role, location, url, postedAt) stay frozen at original scrape
 * values — we don't want them silently changing under the user.
 */
export function upsertJobs(db: DB, sourceName: string, items: NormalizedJob[]): number {
  const now = Math.floor(Date.now() / 1000);
  let inserted = 0;
  for (const item of items) {
    const termsJson = item.terms && item.terms.length > 0 ? JSON.stringify(item.terms) : null;
    const row: NewJob = {
      source: sourceName,
      sourceId: item.sourceId,
      company: item.company,
      role: item.role,
      location: item.location,
      url: item.url,
      postedAt: item.postedAt,
      scrapedAt: now,
      terms: termsJson,
    };
    const insertResult = db.insert(jobs).values(row).onConflictDoNothing().run();
    if (insertResult.changes > 0) {
      inserted += 1;
    } else {
      // Backfill terms on the existing row — but only when the value actually
      // changed. Without the IS NOT guard this issued ~2,800 no-op UPDATEs
      // per scrape cycle. SQLite's IS NOT treats NULLs as comparable.
      db.update(jobs)
        .set({ terms: termsJson })
        .where(and(
          eq(jobs.source, sourceName),
          eq(jobs.sourceId, item.sourceId),
          sql`${jobs.terms} IS NOT ${termsJson}`,
        ))
        .run();
    }
  }
  return inserted;
}

export interface JobFilters {
  includeDismissed?: boolean;
  source?: string;
  /** Case-insensitive substring match across company, role, and location. */
  search?: string;
  limit?: number;
  offset?: number;
  /** Filter to jobs with COALESCE(postedAt, scrapedAt) >= this unix-seconds timestamp. */
  postedAfter?: number;
  /** Filter to jobs whose `terms` JSON contains a string matching the bucket. */
  termBucket?: TermBucket;
  /** When true, skip the default US-only location filter (returns global postings). */
  includeNonUs?: boolean;
  /**
   * Minimum ANNUAL salary. Compares against salaryMax (best case of the range).
   * Because NULL >= n is NULL (falsy) in SQL, applying this filter automatically
   * excludes N/A (un-enriched or genuinely comp-less) rows — which is exactly
   * the "hide N/A when searching by pay" behavior.
   */
  minSalary?: number;
  /** Substring match against location (a market chip like "new york" or "san francisco"). */
  location?: string;
  /** Two-letter US state code (e.g. "NY") matched as ", NY" in the location string. */
  state?: string;
  /** When true, keep only postings whose location mentions "remote". */
  remoteOnly?: boolean;
}

/**
 * Match the JS `termBucket()` helper in lib/ui/ats.ts on the SQL side so the
 * server-rendered count and the chip filter stay in sync. Uses LOWER() because
 * the JS helper is case-insensitive.
 */
function termBucketCondition(bucket: TermBucket): SQL {
  const lower = sql`LOWER(${jobs.terms})`;
  switch (bucket) {
    case "newgrad":
      return sql`${lower} LIKE '%new grad%'`;
    case "summer":
      return sql`${lower} LIKE '%summer%'`;
    case "fall":
      return or(sql`${lower} LIKE '%fall%'`, sql`${lower} LIKE '%autumn%'`)!;
    case "winter":
      return sql`${lower} LIKE '%winter%'`;
    case "spring":
      return sql`${lower} LIKE '%spring%'`;
  }
}

/**
 * Country / region tokens that mean "not US." Matched against the lowercased
 * location string via LIKE. Keep the list ordered roughly by hit-frequency
 * in the aggregator data so the cheap matches reject early.
 *
 * Two special-cases:
 *  - NULL location is kept (could be remote-US or unspecified) — handled by
 *    wrapping the column in COALESCE so NOT LIKE returns true.
 *  - "UK" can't be a plain substring (Milwaukee, Kentucky → false positive).
 *    Use comma-bounded / "in UK" / "(UK)" patterns instead.
 */
const NON_US_LOCATION_KEYWORDS = [
  "canada", "united kingdom", "germany", "france", "spain", "italy",
  "netherlands", "ireland", "india", "china", "japan", "singapore",
  "australia", "brazil", "mexico", "argentina", "colombia", "chile",
  "philippines", "vietnam", "thailand", "indonesia", "malaysia",
  "israel", "belgium", "switzerland", "austria", "poland", "ukraine",
  "russia", "norway", "sweden", "denmark", "finland", "south korea",
  "hong kong", "taiwan", "new zealand", "south africa", "egypt", "uae",
  "saudi arabia", "portugal", "greece", "turkey", "romania",
] as const;

function usOnlyCondition(): SQL {
  const lower = sql`LOWER(COALESCE(${jobs.location}, ''))`;
  const notCountry = NON_US_LOCATION_KEYWORDS.map(
    (kw) => sql`${lower} NOT LIKE ${"%" + kw + "%"}`,
  );
  // Word-boundary "UK" patterns — don't reject "Milwaukee, WI" / "Louisville, KY".
  const notUk = [
    sql`${lower} NOT LIKE '%, uk'`,
    sql`${lower} NOT LIKE '%, uk;%'`,
    sql`${lower} NOT LIKE '%, uk,%'`,
    sql`${lower} NOT LIKE '% in uk%'`,
    sql`${lower} NOT LIKE '%(uk)%'`,
  ];
  return and(...notCountry, ...notUk)!;
}

function buildJobConditions(f: JobFilters): SQL | undefined {
  const conditions: SQL[] = [];
  if (!f.includeDismissed) conditions.push(isNull(jobs.dismissedAt));
  if (f.source) conditions.push(eq(jobs.source, f.source));
  if (typeof f.postedAfter === "number") {
    // Use COALESCE so jobs missing postedAt are kept (fall back to scrapedAt).
    conditions.push(gte(sql`COALESCE(${jobs.postedAt}, ${jobs.scrapedAt})`, f.postedAfter));
  }
  if (f.termBucket) conditions.push(termBucketCondition(f.termBucket));
  if (typeof f.minSalary === "number" && f.minSalary > 0) {
    // gte on a nullable column: SQLite evaluates NULL >= n to NULL, so
    // un-enriched / N/A rows drop out on their own. No IS NOT NULL needed.
    conditions.push(gte(jobs.salaryMax, f.minSalary));
  }
  if (f.remoteOnly) {
    conditions.push(sql`LOWER(COALESCE(${jobs.location}, '')) LIKE '%remote%'`);
  }
  if (f.location && f.location.trim()) {
    const pattern = `%${f.location.trim().toLowerCase()}%`;
    conditions.push(sql`LOWER(COALESCE(${jobs.location}, '')) LIKE ${pattern}`);
  }
  if (f.state && f.state.trim()) {
    // Match the state code as a comma-bounded token ("New York, NY" /
    // "Austin, TX; Remote") so "NY" doesn't hit "Anytown".
    const code = f.state.trim().toLowerCase();
    const lower = sql`LOWER(COALESCE(${jobs.location}, ''))`;
    conditions.push(or(
      sql`${lower} LIKE ${"%, " + code}`,
      sql`${lower} LIKE ${"%, " + code + ",%"}`,
      sql`${lower} LIKE ${"%, " + code + ";%"}`,
      sql`${lower} LIKE ${"%, " + code + " %"}`,
    )!);
  }
  if (f.search && f.search.trim()) {
    // One LIKE per field, OR'd. The pattern is parameter-bound (no injection);
    // a literal % or _ in the query acts as a wildcard, which is fine here.
    const pattern = `%${f.search.trim().toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${jobs.company}) LIKE ${pattern}`,
        sql`LOWER(${jobs.role}) LIKE ${pattern}`,
        sql`LOWER(COALESCE(${jobs.location}, '')) LIKE ${pattern}`,
      )!,
    );
  }
  // US-only is the default unless explicitly opted out (f.includeNonUs = true).
  // The user's job hunt is US-only; non-US postings just create noise.
  if (!f.includeNonUs) conditions.push(usOnlyCondition());
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function listJobs(db: DB, f: JobFilters = {}): Job[] {
  const where = buildJobConditions(f);
  let q = db.select().from(jobs).$dynamic();
  if (where) q = q.where(where);
  q = q.orderBy(
    desc(sql`COALESCE(${jobs.postedAt}, ${jobs.scrapedAt})`),
    desc(jobs.id),
  );
  if (f.limit) q = q.limit(f.limit);
  if (f.offset) q = q.offset(f.offset);
  return q.all();
}

/** Returns total job rows matching the filter — used to power the "N matching" badge. */
export function countJobs(db: DB, f: JobFilters = {}): number {
  const where = buildJobConditions(f);
  let q = db.select({ n: count() }).from(jobs).$dynamic();
  if (where) q = q.where(where);
  return q.get()?.n ?? 0;
}

export function getJob(db: DB, id: number): Job | null {
  return db.select().from(jobs).where(eq(jobs.id, id)).get() ?? null;
}

export function dismissJob(db: DB, id: number): Job | null {
  const now = Math.floor(Date.now() / 1000);
  db.update(jobs).set({ dismissedAt: now }).where(eq(jobs.id, id)).run();
  return getJob(db, id);
}

export function createManualJob(db: DB, fields: Omit<NewJob, "id" | "scrapedAt">): Job {
  const now = Math.floor(Date.now() / 1000);
  return db.insert(jobs).values({ ...fields, scrapedAt: now }).returning().get();
}

/**
 * The enricher's work queue: non-dismissed jobs we've never tried to price
 * yet (salaryEnrichedAt IS NULL), newest first so fresh postings get a salary
 * soonest. `salaryEnrichedAt` is set on every attempt (even a miss), so a row
 * is only ever fetched once.
 */
export function listJobsToEnrich(db: DB, limit: number): Job[] {
  return db
    .select()
    .from(jobs)
    .where(and(isNull(jobs.salaryEnrichedAt), isNull(jobs.dismissedAt)))
    .orderBy(desc(sql`COALESCE(${jobs.postedAt}, ${jobs.scrapedAt})`), desc(jobs.id))
    .limit(limit)
    .all();
}

/** Count of jobs still waiting for a salary attempt — used for the daemon's UI badge. */
export function countJobsToEnrich(db: DB): number {
  return (
    db
      .select({ n: count() })
      .from(jobs)
      .where(and(isNull(jobs.salaryEnrichedAt), isNull(jobs.dismissedAt)))
      .get()?.n ?? 0
  );
}

/**
 * Record the result of a single enrichment attempt. Always stamps
 * salaryEnrichedAt (so the row leaves the queue); `salary` null means the page
 * had no usable pay — the salary columns stay null and it reads as "N/A".
 */
export function setJobSalary(
  db: DB,
  id: number,
  salary: { raw: string; min: number; max: number } | null,
): void {
  const now = Math.floor(Date.now() / 1000);
  db.update(jobs)
    .set({
      salaryRaw: salary?.raw ?? null,
      salaryMin: salary?.min ?? null,
      salaryMax: salary?.max ?? null,
      salaryEnrichedAt: now,
    })
    .where(eq(jobs.id, id))
    .run();
}
