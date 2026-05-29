export type Status = "applied" | "screen" | "interview" | "offer" | "rejected";

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
  lastCount: number | null;
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
}

export interface OverviewResponse {
  statusCounts: Record<Status, number>;
  jobsTotal: number;
  jobsOpen: number;
}
