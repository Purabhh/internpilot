import { sqliteTable, integer, text, real, unique } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  sourceId: text("source_id").notNull(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  location: text("location"),
  url: text("url").notNull(),
  postedAt: integer("posted_at"),
  scrapedAt: integer("scraped_at").notNull(),
  dismissedAt: integer("dismissed_at"),
  // JSON-encoded array of term strings, e.g. '["Fall 2026","Winter 2027"]' or '["New Grad"]'.
  terms: text("terms"),
  // --- Salary enrichment (filled in later by the enricher daemon, not the scraper) ---
  // The pay string exactly as found on the posting page, e.g. "$45.00 - $60.00/hour"
  // or "$120,000/yr". Null until we've looked; stays null when the page shows nothing.
  salaryRaw: text("salary_raw"),
  // Normalized to an ANNUAL figure so a single min-salary filter works across
  // hourly / monthly / yearly postings (hourly x 2080, monthly x 12). For a
  // range, salaryMin is the floor and salaryMax the ceiling; a single value sets
  // both equal. The min-salary filter compares against salaryMax (best case).
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  // Unix seconds of the enrichment ATTEMPT. Null = never tried (queue picks it
  // up). Set-but-salaryMax-null = tried, page had no pay (genuine N/A) — this is
  // what stops the enricher re-fetching the same links forever.
  salaryEnrichedAt: integer("salary_enriched_at"),
}, (t) => ({
  sourceUnique: unique().on(t.source, t.sourceId),
}));

export const resumes = sqliteTable("resumes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedAt: integer("uploaded_at").notNull(),
  usedCount: integer("used_count").notNull().default(0),
  isDefault: integer("is_default").notNull().default(0),
});

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id").references(() => jobs.id),
  company: text("company").notNull(),
  role: text("role").notNull(),
  location: text("location"),
  url: text("url"),
  // "saved" is the pre-application stage: a job bookmarked from the board to
  // apply to later. It lives in this table (not on jobs) so the tracker's
  // Kanban, drag-and-drop, and the email pipeline's status updates all work on
  // it unchanged — a confirmation email flips it to "applied" automatically.
  status: text("status", { enum: ["saved", "applied", "screen", "interview", "offer", "rejected"] }).notNull(),
  notes: text("notes"),
  appliedAt: integer("applied_at").notNull(),
  lastEmailAt: integer("last_email_at"),
  resumeId: integer("resume_id").references(() => resumes.id),
  // Starred "definitely apply" flag. Just a sort key: starred cards float to
  // the top of their column; status and the email pipeline ignore it.
  priority: integer("priority").notNull().default(0),
});

export const emails = sqliteTable("emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gmailMsgId: text("gmail_msg_id").notNull().unique(),
  threadId: text("thread_id"),
  fromAddr: text("from_addr"),
  subject: text("subject"),
  snippet: text("snippet"),
  receivedAt: integer("received_at").notNull(),
  classifiedCompany: text("classified_company"),
  classifiedStatus: text("classified_status"),
  confidence: real("confidence"),
  applicationId: integer("application_id").references(() => applications.id),
  classifier: text("classifier"),
  needsReview: integer("needs_review").notNull().default(0),
});

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  url: text("url").notNull(),
  type: text("type", { enum: ["github_json", "github_md_table"] }).notNull(),
  enabled: integer("enabled").notNull().default(1),
  lastRunAt: integer("last_run_at"),
  /** Total items the scraper returned on the last run (pre-dedup). */
  lastCount: integer("last_count"),
  /** Number of NEW rows inserted on the last run — distinct from lastCount,
   *  which is "items returned" and stays roughly constant even when nothing
   *  new appeared upstream. This is the real signal that work happened. */
  lastInserted: integer("last_inserted"),
  /** Unix-seconds timestamp of the last run that actually inserted at least
   *  one new row. Used to surface upstream droughts in the UI ("new 3d ago"). */
  lastInsertedAt: integer("last_inserted_at"),
  lastError: text("last_error"),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  scraperEnabled: integer("scraper_enabled").notNull().default(0),
  trackerEnabled: integer("tracker_enabled").notNull().default(0),
  scraperIntervalMin: integer("scraper_interval_min").notNull().default(60),
  trackerIntervalMin: integer("tracker_interval_min").notNull().default(3),
  gmailConnectedAt: integer("gmail_connected_at"),
  gmailHistoryId: text("gmail_history_id"),
  /** Unix seconds of the last tracker tick (success OR error). The Overview
   *  MasterToggle reads this to render "LAST: 2m ago" — distinct from
   *  gmailConnectedAt (which is when the user first authorized Gmail). */
  trackerLastRunAt: integer("tracker_last_run_at"),
  /** Number of brand-new emails inserted on the last tick. 0 means "ran fine,
   *  Gmail had nothing new" — same semantics as sources.lastInserted. */
  trackerLastInserted: integer("tracker_last_inserted"),
  /** Last error string from a failed tick, or null if the last tick succeeded. */
  trackerLastError: text("tracker_last_error"),
  // --- Salary enricher daemon (third background job, alongside scraper/tracker) ---
  enrichEnabled: integer("enrich_enabled").notNull().default(0),
  enrichIntervalMin: integer("enrich_interval_min").notNull().default(10),
  /** Unix seconds of the last enricher tick (success OR error). */
  enrichLastRunAt: integer("enrich_last_run_at"),
  /** Number of jobs a salary was FOUND for on the last tick (not "attempted"). */
  enrichLastCount: integer("enrich_last_count"),
  /** Last error string from a failed enricher tick, or null on success. */
  enrichLastError: text("enrich_last_error"),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type NewResume = typeof resumes.$inferInsert;
export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type Status = "saved" | "applied" | "screen" | "interview" | "offer" | "rejected";
