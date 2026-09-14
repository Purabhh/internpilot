import { desc, eq, count } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { emails, type Email, type NewEmail } from "@/lib/db/schema";

export function insertEmailIfNew(db: DB, row: NewEmail): Email | null {
  const result = db.insert(emails).values(row).onConflictDoNothing().returning().get();
  return result ?? null;
}

export interface EmailListOpts {
  limit?: number;
  offset?: number;
}

export function listEmails(db: DB, opts: EmailListOpts = {}): Email[] {
  const { limit = 50, offset = 0 } = opts;
  let q = db.select().from(emails).orderBy(desc(emails.receivedAt), desc(emails.id)).limit(limit).$dynamic();
  if (offset > 0) q = q.offset(offset);
  return q.all();
}

/** Total emails and how many still need review — powers pagination + badges
 *  without fetching every row just to call `.length` on it. */
export function countEmails(db: DB): { total: number; needsReview: number } {
  const total = db.select({ n: count() }).from(emails).get()?.n ?? 0;
  const needsReview =
    db.select({ n: count() }).from(emails).where(eq(emails.needsReview, 1)).get()?.n ?? 0;
  return { total, needsReview };
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
