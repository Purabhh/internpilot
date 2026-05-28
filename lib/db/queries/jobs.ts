import { and, desc, eq, isNull } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { jobs, type Job, type NewJob } from "@/lib/db/schema";
import type { NormalizedJob } from "@/lib/scrapers/base";

export function upsertJobs(db: DB, sourceName: string, items: NormalizedJob[]): number {
  const now = Math.floor(Date.now() / 1000);
  let inserted = 0;
  for (const item of items) {
    const row: NewJob = {
      source: sourceName,
      sourceId: item.sourceId,
      company: item.company,
      role: item.role,
      location: item.location,
      url: item.url,
      postedAt: item.postedAt,
      scrapedAt: now,
    };
    const result = db.insert(jobs).values(row).onConflictDoNothing().run();
    if (result.changes > 0) inserted += 1;
  }
  return inserted;
}

export interface JobFilters {
  includeDismissed?: boolean;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function listJobs(db: DB, f: JobFilters = {}): Job[] {
  const conditions = [];
  if (!f.includeDismissed) conditions.push(isNull(jobs.dismissedAt));
  if (f.source) conditions.push(eq(jobs.source, f.source));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  let q = db.select().from(jobs).$dynamic();
  if (where) q = q.where(where);
  q = q.orderBy(desc(jobs.scrapedAt), desc(jobs.id));
  if (f.limit) q = q.limit(f.limit);
  if (f.offset) q = q.offset(f.offset);
  return q.all();
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
