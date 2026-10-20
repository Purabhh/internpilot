CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT,
  url TEXT NOT NULL,
  posted_at INTEGER,
  scraped_at INTEGER NOT NULL,
  dismissed_at INTEGER,
  terms TEXT,
  salary_raw TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_enriched_at INTEGER,
  UNIQUE(source, source_id)
);

CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at INTEGER NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER REFERENCES jobs(id),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT,
  url TEXT,
  status TEXT NOT NULL CHECK (status IN ('saved','applied','screen','interview','offer','rejected')),
  notes TEXT,
  applied_at INTEGER NOT NULL,
  last_email_at INTEGER,
  resume_id INTEGER REFERENCES resumes(id)
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_msg_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  from_addr TEXT,
  subject TEXT,
  snippet TEXT,
  received_at INTEGER NOT NULL,
  classified_company TEXT,
  classified_status TEXT,
  confidence REAL,
  application_id INTEGER REFERENCES applications(id),
  classifier TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  last_count INTEGER,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  scraper_enabled INTEGER NOT NULL DEFAULT 0,
  tracker_enabled INTEGER NOT NULL DEFAULT 0,
  scraper_interval_min INTEGER NOT NULL DEFAULT 60,
  tracker_interval_min INTEGER NOT NULL DEFAULT 10,
  gmail_connected_at INTEGER,
  gmail_history_id TEXT,
  enrich_enabled INTEGER NOT NULL DEFAULT 0,
  enrich_interval_min INTEGER NOT NULL DEFAULT 10,
  enrich_last_run_at INTEGER,
  enrich_last_count INTEGER,
  enrich_last_error TEXT
);
