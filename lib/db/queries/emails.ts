import { desc, eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { emails, type Email, type NewEmail } from "@/lib/db/schema";

export function insertEmailIfNew(db: DB, row: NewEmail): Email | null {
  const result = db.insert(emails).values(row).onConflictDoNothing().returning().get();
  return result ?? null;
}

export function listEmails(db: DB, limit = 100): Email[] {
  return db.select().from(emails).orderBy(desc(emails.receivedAt)).limit(limit).all();
}

export function getEmail(db: DB, id: number): Email | null {
  return db.select().from(emails).where(eq(emails.id, id)).get() ?? null;
}

export function correctEmail(
  db: DB,
  id: number,
  correction: { classifiedStatus?: string; classifiedCompany?: string; applicationId?: number | null },
): Email | null {
  const filtered: Record<string, unknown> = {};
  if (correction.classifiedStatus !== undefined) filtered.classifiedStatus = correction.classifiedStatus;
  if (correction.classifiedCompany !== undefined) filtered.classifiedCompany = correction.classifiedCompany;
  if (correction.applicationId !== undefined) filtered.applicationId = correction.applicationId;
  filtered.needsReview = 0;
  if (Object.keys(filtered).length > 0) {
    db.update(emails).set(filtered).where(eq(emails.id, id)).run();
  }
  return getEmail(db, id);
}
