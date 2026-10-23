import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { settings, sources } from "./schema";

const SEED_SOURCES = [
  {
    name: "simplify_summer26_offseason",
    url: "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json",
    type: "github_json" as const,
    enabled: 1,
  },
  {
    name: "simplify_newgrad",
    url: "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json",
    type: "github_json" as const,
    enabled: 1,
  },
  {
    name: "vansh_summer27_offseason",
    url: "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json",
    type: "github_json" as const,
    enabled: 1,
  },
  {
    // speedyapply only ships markdown tables, no JSON. Disabled until we add a
    // markdown-table parser. The scraper class is a stub that returns [].
    name: "speedyapply_swe26",
    url: "https://github.com/speedyapply/2026-SWE-College-Jobs",
    type: "github_md_table" as const,
    enabled: 0,
  },
  {
    // Jobright publishes markdown tables (parsed by JobrightScraper). Two
    // categories that match the SWE intern / new-grad hunt.
    name: "jobright_swe_internship",
    url: "https://raw.githubusercontent.com/jobright-ai/2026-Software-Engineer-Internship/master/README.md",
    type: "github_md_table" as const,
    enabled: 1,
  },
  {
    name: "jobright_swe_newgrad",
    url: "https://raw.githubusercontent.com/jobright-ai/2026-Software-Engineer-New-Grad/master/README.md",
    type: "github_md_table" as const,
    enabled: 1,
  },
];

export type DB = BetterSQLite3Database<typeof schema>;

// Cache opened databases on globalThis so every API route shares one
// connection per path instead of re-opening (and re-running migrations +
// seeds) on every request. globalThis survives Next.js dev-mode module
// reloads — the standard pattern for long-lived handles in Next.
// `:memory:` paths are NEVER cached: each one is a distinct database by
// definition, and tests rely on freshDb() returning isolated instances.
const globalCache = globalThis as unknown as { __internpilotDbCache?: Map<string, DB> };

export function openDb(dbPath: string): DB {
  if (dbPath === ":memory:") return createDb(dbPath);
  const cache = (globalCache.__internpilotDbCache ??= new Map<string, DB>());
  const existing = cache.get(dbPath);
  if (existing) return existing;
  const db = createDb(dbPath);
  cache.set(dbPath, db);
  return db;
}

function createDb(dbPath: string): DB {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const migrationPath = path.join(process.cwd(), "lib", "db", "migrations", "0001_init.sql");
  const migrationSql = readFileSync(migrationPath, "utf-8");
  sqlite.exec(migrationSql);

  // Idempotent column additions for existing DBs. SQLite has no IF NOT EXISTS
  // for ALTER TABLE, so we swallow the "duplicate column" error.
  try { sqlite.exec("ALTER TABLE jobs ADD COLUMN terms TEXT"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE sources ADD COLUMN last_inserted INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE sources ADD COLUMN last_inserted_at INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN tracker_last_run_at INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN tracker_last_inserted INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN tracker_last_error TEXT"); } catch { /* already exists */ }
  // Salary enrichment columns on jobs (filled by the enricher daemon).
  try { sqlite.exec("ALTER TABLE jobs ADD COLUMN salary_raw TEXT"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE jobs ADD COLUMN salary_min INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE jobs ADD COLUMN salary_max INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE jobs ADD COLUMN salary_enriched_at INTEGER"); } catch { /* already exists */ }
  // Enricher daemon settings.
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN enrich_enabled INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN enrich_interval_min INTEGER NOT NULL DEFAULT 10"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN enrich_last_run_at INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN enrich_last_count INTEGER"); } catch { /* already exists */ }
  try { sqlite.exec("ALTER TABLE settings ADD COLUMN enrich_last_error TEXT"); } catch { /* already exists */ }
  // One-time retune of the enricher from every 30 min to every 10 min. The
  // marker column makes it run once, so a later manual change sticks.
  try {
    sqlite.exec("ALTER TABLE settings ADD COLUMN enrich_retuned INTEGER NOT NULL DEFAULT 0");
    sqlite.exec("UPDATE settings SET enrich_interval_min = 10 WHERE enrich_interval_min = 30");
    sqlite.exec("UPDATE settings SET enrich_retuned = 1");
  } catch { /* already retuned */ }

  migrateApplicationsStatusCheck(sqlite);
  // After the status rebuild above, which copies an explicit column list.
  try { sqlite.exec("ALTER TABLE applications ADD COLUMN priority INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }

  const db = drizzle(sqlite, { schema });

  seedSettings(db);
  seedSources(db);

  return db;
}

/**
 * applications.status carries a CHECK constraint baked into CREATE TABLE, and
 * SQLite can't ALTER a CHECK in place. When "saved" joined the status enum,
 * any DB created under the older 5-value CHECK would reject every saved row
 * with "CHECK constraint failed". So: sniff the live table definition out of
 * sqlite_master and, if it predates "saved", rebuild the table the way the
 * SQLite docs prescribe — new table, copy rows, drop old, rename. Row ids are
 * preserved, so emails.application_id links survive. Idempotent: a DB whose
 * CHECK already lists 'saved' (fresh installs, or one already migrated) is
 * left untouched.
 */
function migrateApplicationsStatusCheck(sqlite: Database.Database): void {
  const row = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'applications'")
    .get() as { sql: string } | undefined;
  if (!row || row.sql.includes("'saved'")) return;

  // emails.application_id references this table, so DROP TABLE under
  // foreign_keys=ON would fail the FK check. The pragma is a no-op inside a
  // transaction, so it has to be toggled around the transaction, not within.
  sqlite.pragma("foreign_keys = OFF");
  try {
    sqlite.transaction(() => {
      sqlite.exec(`
        CREATE TABLE applications_new (
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
        INSERT INTO applications_new
          SELECT id, job_id, company, role, location, url, status, notes, applied_at, last_email_at, resume_id
          FROM applications;
        DROP TABLE applications;
        ALTER TABLE applications_new RENAME TO applications;
      `);
    })();
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}

function seedSettings(db: DB): void {
  const existing = db.select().from(settings).all();
  if (existing.length === 0) {
    db.insert(settings).values({ id: 1 }).run();
  }
}

function seedSources(db: DB): void {
  for (const src of SEED_SOURCES) {
    db.insert(sources).values(src).onConflictDoNothing().run();
  }
}
