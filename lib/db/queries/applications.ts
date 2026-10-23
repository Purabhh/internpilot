import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { applications, emails, jobs, type Application, type Job, type Status } from "@/lib/db/schema";

interface CreateInput {
  company: string;
  role: string;
  location?: string | null;
  url?: string | null;
  resumeId?: number | null;
}

export function createApplication(db: DB, input: CreateInput): Application {
  const now = Math.floor(Date.now() / 1000);
  return db.insert(applications).values({
    company: input.company,
    role: input.role,
    location: input.location ?? null,
    url: input.url ?? null,
    resumeId: input.resumeId ?? null,
    status: "applied",
    appliedAt: now,
    jobId: null,
  }).returning().get();
}

/**
 * Create an application row pre-linked to a job. Defaults to "applied" (the
 * jobs-board check button and the email pipeline); pass "saved" for the
 * bookmark button so the row lands in the tracker's Saved column instead.
 */
export function createApplicationFromJob(db: DB, job: Job, status: Status = "applied"): Application {
  const now = Math.floor(Date.now() / 1000);
  return db.insert(applications).values({
    jobId: job.id,
    company: job.company,
    role: job.role,
    location: job.location,
    url: job.url,
    status,
    appliedAt: now,
  }).returning().get();
}

/** Find the application linked to a given job, if one exists. Used to avoid
 *  creating duplicate applications when linking an email to a job posting. */
export function getApplicationByJobId(db: DB, jobId: number): Application | null {
  return db.select().from(applications).where(eq(applications.jobId, jobId)).get() ?? null;
}

interface ListFilters {
  status?: Status;
  company?: string;
}

/** An application plus when its linked job was posted (falling back to when we
 *  first scraped it). Null for manual applications with no job. */
export type ApplicationListItem = Application & { jobPostedAt: number | null };

export function listApplications(db: DB, f: ListFilters = {}): ApplicationListItem[] {
  const conds = [];
  if (f.status) conds.push(eq(applications.status, f.status));
  if (f.company) conds.push(eq(applications.company, f.company));
  let q = db
    .select({
      ...getTableColumns(applications),
      jobPostedAt: sql<number | null>`coalesce(${jobs.postedAt}, ${jobs.scrapedAt})`,
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .$dynamic();
  if (conds.length > 0) q = q.where(and(...conds));
  return q.orderBy(desc(applications.priority), desc(applications.appliedAt), desc(applications.id)).all();
}

export function getApplication(db: DB, id: number): Application | null {
  return db.select().from(applications).where(eq(applications.id, id)).get() ?? null;
}

export interface AppPatch {
  status?: Status;
  notes?: string | null;
  lastEmailAt?: number | null;
  resumeId?: number | null;
  company?: string;
  role?: string;
  priority?: boolean;
}

export function updateApplication(db: DB, id: number, patch: AppPatch): Application | null {
  const filtered: Record<string, unknown> = {};
  if (patch.priority !== undefined) filtered.priority = patch.priority ? 1 : 0;
  if (patch.status !== undefined) filtered.status = patch.status;
  if (patch.notes !== undefined) filtered.notes = patch.notes;
  if (patch.lastEmailAt !== undefined) filtered.lastEmailAt = patch.lastEmailAt;
  if (patch.resumeId !== undefined) filtered.resumeId = patch.resumeId;
  // Empty/whitespace-only company or role are ignored — the card's inline edit
  // can fire a blur with a blank value, and we don't want to wipe the field.
  if (patch.company !== undefined && patch.company.trim()) filtered.company = patch.company.trim();
  if (patch.role !== undefined && patch.role.trim()) filtered.role = patch.role.trim();
  if (Object.keys(filtered).length > 0) {
    db.update(applications).set(filtered).where(eq(applications.id, id)).run();
  }
  return getApplication(db, id);
}

export function deleteApplication(db: DB, id: number): Application | null {
  const existing = getApplication(db, id);
  if (!existing) return null;
  // Detach any emails that were linked to this application. The FK is RESTRICT
  // by default so a raw delete throws "FOREIGN KEY constraint failed". Setting
  // applicationId=null and bumping needsReview=1 turns those emails into
  // orphans the user can re-triage — better than a cascade-delete which would
  // silently lose the email history.
  db.update(emails)
    .set({ applicationId: null, needsReview: 1 })
    .where(eq(emails.applicationId, id))
    .run();
  db.delete(applications).where(eq(applications.id, id)).run();
  return existing;
}
