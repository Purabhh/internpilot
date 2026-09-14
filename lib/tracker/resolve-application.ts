import type { DB } from "@/lib/db/client";
import type { Application } from "@/lib/db/schema";
import { matchEmailToApplication, matchEmailToJob } from "./matcher";
import { createApplication, createApplicationFromJob } from "@/lib/db/queries/applications";

export interface ResolveOpts {
  company: string | null;
  senderDomain?: string | null;
  /** Subject + snippet, used to match a specific Job by URL or role title. */
  emailText?: string;
  /** When true, create a new application if no existing one matches. */
  createIfMissing: boolean;
}

/**
 * Decide which Application an inbound/edited email belongs to:
 *   1. Match an existing application by company name (or sender-domain stem).
 *   2. If none and `createIfMissing`, create one — linked to a matching Job
 *      (found by URL or role title in the email text) when possible, else a
 *      standalone "(unknown role)" application.
 * Returns null when there's no company, or no match and createIfMissing=false.
 *
 * This is shared by BOTH the automatic tracker pipeline and the manual
 * email-fix route. They used to carry separate copies of this logic, and only
 * the pipeline could create — so hand-fixing an email to "Company / applied"
 * cleared needs-review but produced no tracker card. One resolver = no drift.
 */
export function resolveApplicationForEmail(db: DB, opts: ResolveOpts): Application | null {
  const { company, senderDomain = null, emailText = "", createIfMissing } = opts;
  if (!company) return null;

  const existing = matchEmailToApplication(db, company, senderDomain);
  if (existing) return existing;
  if (!createIfMissing) return null;

  const job = matchEmailToJob(db, company, emailText);
  return job
    ? createApplicationFromJob(db, job)
    : createApplication(db, { company, role: "(unknown role)" });
}
