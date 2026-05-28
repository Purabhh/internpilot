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
  status: text("status", { enum: ["applied", "screen", "interview", "offer", "rejected"] }).notNull(),
  notes: text("notes"),
  appliedAt: integer("applied_at").notNull(),
  lastEmailAt: integer("last_email_at"),
  resumeId: integer("resume_id").references(() => resumes.id),
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
  lastCount: integer("last_count"),
  lastError: text("last_error"),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  scraperEnabled: integer("scraper_enabled").notNull().default(0),
  trackerEnabled: integer("tracker_enabled").notNull().default(0),
  scraperIntervalMin: integer("scraper_interval_min").notNull().default(60),
  trackerIntervalMin: integer("tracker_interval_min").notNull().default(10),
  gmailConnectedAt: integer("gmail_connected_at"),
  gmailHistoryId: text("gmail_history_id"),
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
export type Status = "applied" | "screen" | "interview" | "offer" | "rejected";
