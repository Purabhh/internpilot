import { desc } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { applications, type Application } from "@/lib/db/schema";

const SUFFIX_RE = /,?\s+(inc\.?|llc\.?|ltd\.?|corp\.?|co\.?|gmbh|ag|sa|securities|capital management|capital|holdings|group)$/i;

export function normalizeCompany(s: string): string {
  let out = s.toLowerCase().replace(/[‘’“”]/g, "'");
  out = out.replace(/\s+/g, " ").trim();
  // Strip legal suffix repeatedly: "Foo Inc Holdings" -> "Foo Inc" -> "Foo"
  let prev = "";
  while (prev !== out) {
    prev = out;
    out = out.replace(SUFFIX_RE, "").trim();
  }
  return out;
}

export function matchEmailToApplication(
  db: DB,
  classifiedCompany: string | null,
  _senderDomain: string | null,
): Application | null {
  if (!classifiedCompany) return null;
  const target = normalizeCompany(classifiedCompany);
  if (!target) return null;
  const rows = db
    .select()
    .from(applications)
    .orderBy(desc(applications.appliedAt), desc(applications.id))
    .all();
  const matches = rows.filter((r) => normalizeCompany(r.company) === target);
  return matches[0] ?? null;
}
