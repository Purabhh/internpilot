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
  },
  {
    name: "simplify_newgrad",
    url: "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/.github/scripts/listings.json",
    type: "github_json" as const,
  },
  {
    name: "vansh_summer27_offseason",
    url: "https://raw.githubusercontent.com/vanshb03/Summer2027-Internships/dev/.github/scripts/listings.json",
    type: "github_json" as const,
  },
  {
    name: "speedyapply_swe26",
    url: "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/listings.json",
    type: "github_json" as const,
  },
];

export type DB = BetterSQLite3Database<typeof schema>;

export function openDb(dbPath: string): DB {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const migrationPath = path.join(process.cwd(), "lib", "db", "migrations", "0001_init.sql");
  const migrationSql = readFileSync(migrationPath, "utf-8");
  sqlite.exec(migrationSql);

  const db = drizzle(sqlite, { schema });

  seedSettings(db);
  seedSources(db);

  return db;
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
