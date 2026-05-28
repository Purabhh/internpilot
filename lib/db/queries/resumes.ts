import { desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { resumes, type Resume, type NewResume } from "@/lib/db/schema";

type CreateInput = Omit<NewResume, "uploadedAt" | "usedCount" | "isDefault" | "id">;

export function createResume(db: DB, input: CreateInput): Resume {
  const now = Math.floor(Date.now() / 1000);
  const result = db.insert(resumes).values({
    ...input,
    uploadedAt: now,
    usedCount: 0,
    isDefault: 0,
  }).returning().get();
  return result;
}

export function listResumes(db: DB): Resume[] {
  return db.select().from(resumes).orderBy(desc(resumes.uploadedAt), desc(resumes.id)).all();
}

export function getResume(db: DB, id: number): Resume | null {
  return db.select().from(resumes).where(eq(resumes.id, id)).get() ?? null;
}

export function setDefaultResume(db: DB, id: number): Resume | null {
  db.update(resumes).set({ isDefault: 0 }).run();
  db.update(resumes).set({ isDefault: 1 }).where(eq(resumes.id, id)).run();
  return getResume(db, id);
}

export function renameResume(db: DB, id: number, title: string): Resume | null {
  db.update(resumes).set({ title }).where(eq(resumes.id, id)).run();
  return getResume(db, id);
}

export function deleteResume(db: DB, id: number): Resume | null {
  const existing = getResume(db, id);
  if (!existing) return null;
  db.delete(resumes).where(eq(resumes.id, id)).run();
  return existing;
}

export function incrementUsedCount(db: DB, id: number): void {
  const r = getResume(db, id);
  if (!r) return;
  db.update(resumes).set({ usedCount: r.usedCount + 1 }).where(eq(resumes.id, id)).run();
}
