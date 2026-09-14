import { desc, isNull } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { applications, jobs, type Application, type Job } from "@/lib/db/schema";

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

/**
 * Pull the domain out of a From header, handling both bare addresses and the
 * "Display Name <user@host>" form: "Tesla <noreply@tesla.com>" -> "tesla.com".
 * Returns null when there's no parseable address.
 */
export function parseSenderDomain(from: string | null | undefined): string | null {
  if (!from) return null;
  const m = from.match(/@([A-Za-z0-9.-]+)/);
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Strip subdomains and TLDs from a sender domain to get the company stem.
 *   "tiktok.com"            -> "tiktok"
 *   "mail.tiktok.com"       -> "tiktok"
 *   "noreply.greenhouse.io" -> "greenhouse"
 *   "foo.co.uk"             -> "foo"
 * Pops short trailing segments (<=3 chars) as TLDs, then returns the last
 * remaining segment. Good enough for the major ATSs and most company domains.
 */
function domainStem(domain: string | null): string {
  if (!domain) return "";
  const parts = domain.toLowerCase().split(".").filter(Boolean);
  while (parts.length > 1 && parts[parts.length - 1]!.length <= 3) {
    parts.pop();
  }
  return parts[parts.length - 1] ?? "";
}

/**
 * Find an existing Application that matches an inbound email. Priority:
 *   1. Exact normalized company match — fast path for clean classifications
 *   2. Substring match in either direction — catches "TikTok Early Careers"
 *      (extracted from "applying to TikTok Early Careers") vs existing "TikTok"
 *   3. Sender-domain stem match — last-resort signal when extractCompany
 *      missed; "noreply@tiktok.com" should still attach to a TikTok app
 * Returns the most recent matching application (rows sorted by appliedAt DESC).
 */
export function matchEmailToApplication(
  db: DB,
  classifiedCompany: string | null,
  senderDomain: string | null,
): Application | null {
  if (!classifiedCompany && !senderDomain) return null;
  const rows = db
    .select()
    .from(applications)
    .orderBy(desc(applications.appliedAt), desc(applications.id))
    .all();

  if (classifiedCompany) {
    const target = normalizeCompany(classifiedCompany);
    if (target) {
      const exact = rows.find((r) => normalizeCompany(r.company) === target);
      if (exact) return exact;
      const substr = rows.find((r) => {
        const c = normalizeCompany(r.company);
        return c.length > 0 && (c.includes(target) || target.includes(c));
      });
      if (substr) return substr;
    }
  }

  const stem = domainStem(senderDomain);
  if (stem.length >= 3) {
    const byDomain = rows.find((r) => {
      const c = normalizeCompany(r.company);
      return c.length > 0 && (c.includes(stem) || stem.includes(c));
    });
    if (byDomain) return byDomain;
  }

  return null;
}

/**
 * Find a Job row matching an inbound confirmation email so we can auto-create
 * an Application pre-linked to it. Strategy per user spec: among non-dismissed
 * jobs at the same company, accept the match iff EITHER the job's URL OR its
 * role title appears in the email's subject+snippet text. If neither hits,
 * return null — the caller falls back to creating an Application without a
 * jobId rather than guessing wrong.
 */
export function matchEmailToJob(
  db: DB,
  classifiedCompany: string | null,
  emailText: string,
): Job | null {
  if (!classifiedCompany) return null;
  const target = normalizeCompany(classifiedCompany);
  if (!target) return null;
  const candidates = db.select().from(jobs).where(isNull(jobs.dismissedAt)).all();
  const sameCompany = candidates.filter((j) => normalizeCompany(j.company) === target);
  if (sameCompany.length === 0) return null;

  // 1) URL match — strongest signal. Confirmation emails frequently include
  //    a link back to the posting (Greenhouse/Workday/Ashby track this).
  const urlHit = sameCompany.find((j) => j.url && emailText.includes(j.url));
  if (urlHit) return urlHit;

  // 2) Role-title match — case-insensitive substring of the email text.
  const lowered = emailText.toLowerCase();
  const roleHit = sameCompany.find((j) => j.role && lowered.includes(j.role.toLowerCase()));
  if (roleHit) return roleHit;

  return null;
}
