export type Status = "saved" | "applied" | "screen" | "interview" | "offer" | "rejected";

export interface Job {
  id: number;
  source: string;
  sourceId: string;
  company: string;
  role: string;
  location: string | null;
  url: string;
  postedAt: number | null;
  scrapedAt: number;
  dismissedAt: number | null;
  /** JSON-encoded array of term strings — parse with `parseTerms(job.terms)`. */
  terms: string | null;
  /** Pay string as found on the posting page, or null (N/A). */
  salaryRaw: string | null;
  /** Annualized floor / ceiling of the pay range, or null when N/A. */
  salaryMin: number | null;
  salaryMax: number | null;
  /** Unix seconds of the enrichment attempt; null = not yet tried. */
  salaryEnrichedAt: number | null;
}

export interface Application {
  id: number;
  jobId: number | null;
  company: string;
  role: string;
  location: string | null;
  url: string | null;
  status: Status;
  notes: string | null;
  appliedAt: number;
  lastEmailAt: number | null;
  resumeId: number | null;
}

export interface Resume {
  id: number;
  title: string;
  filename: string;
  path: string;
  mimeType: string;
  uploadedAt: number;
  usedCount: number;
  isDefault: number;
}

export interface Email {
  id: number;
  gmailMsgId: string;
  threadId: string | null;
  fromAddr: string | null;
  subject: string | null;
  snippet: string | null;
  receivedAt: number;
  classifiedCompany: string | null;
  classifiedStatus: Status | null;
  confidence: number | null;
  applicationId: number | null;
  classifier: "rules" | "llm" | "needs_review" | null;
  needsReview: number;
}

export interface Source {
  id: number;
  name: string;
  url: string;
  type: string;
  enabled: number;
  lastRunAt: number | null;
  /** Total items returned by the scraper on the last run (pre-dedup). */
  lastCount: number | null;
  /** Truly new rows inserted on the last run — `0` means upstream had nothing new. */
  lastInserted: number | null;
  /** Unix seconds of the last run that produced at least one new row. */
  lastInsertedAt: number | null;
  lastError: string | null;
}

export interface Settings {
  id: number;
  scraperEnabled: number;
  trackerEnabled: number;
  scraperIntervalMin: number;
  trackerIntervalMin: number;
  gmailConnectedAt: number | null;
  gmailHistoryId: string | null;
  /** Unix seconds of the last tracker tick — independent of gmailConnectedAt. */
  trackerLastRunAt: number | null;
  /** New emails inserted on the last tick (0 = ran fine, nothing new). */
  trackerLastInserted: number | null;
  trackerLastError: string | null;
  enrichEnabled: number;
  enrichIntervalMin: number;
  enrichLastRunAt: number | null;
  /** Salaries found on the last enricher tick (0 = ran fine, none found). */
  enrichLastCount: number | null;
  enrichLastError: string | null;
}

export interface OverviewResponse {
  statusCounts: Record<Status, number>;
  jobsTotal: number;
  jobsOpen: number;
}
