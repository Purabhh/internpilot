import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { applications, type Application, type Job, type Status } from "@/lib/db/schema";

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

export function createApplicationFromJob(db: DB, job: Job): Application {
  const now = Math.floor(Date.now() / 1000);
  return db.insert(applications).values({
    jobId: job.id,
    company: job.company,
    role: job.role,
    location: job.location,
    url: job.url,
    status: "applied",
    appliedAt: now,
  }).returning().get();
}

interface ListFilters {
  status?: Status;
  company?: string;
}

export function listApplications(db: DB, f: ListFilters = {}): Application[] {
  const conds = [];
  if (f.status) conds.push(eq(applications.status, f.status));
  if (f.company) conds.push(eq(applications.company, f.company));
  let q = db.select().from(applications).$dynamic();
  if (conds.length > 0) q = q.where(and(...conds));
  return q.orderBy(desc(applications.appliedAt), desc(applications.id)).all();
}

export function getApplication(db: DB, id: number): Application | null {
  return db.select().from(applications).where(eq(applications.id, id)).get() ?? null;
}

export interface AppPatch {
  status?: Status;
  notes?: string | null;
  lastEmailAt?: number | null;
  resumeId?: number | null;
}

export function updateApplication(db: DB, id: number, patch: AppPatch): Application | null {
  const filtered: Record<string, unknown> = {};
  if (patch.status !== undefined) filtered.status = patch.status;
  if (patch.notes !== undefined) filtered.notes = patch.notes;
  if (patch.lastEmailAt !== undefined) filtered.lastEmailAt = patch.lastEmailAt;
  if (patch.resumeId !== undefined) filtered.resumeId = patch.resumeId;
  if (Object.keys(filtered).length > 0) {
    db.update(applications).set(filtered).where(eq(applications.id, id)).run();
  }
  return getApplication(db, id);
}

export function deleteApplication(db: DB, id: number): Application | null {
  const existing = getApplication(db, id);
  if (!existing) return null;
  db.delete(applications).where(eq(applications.id, id)).run();
  return existing;
}
