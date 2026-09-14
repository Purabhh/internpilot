import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDb } from "@/lib/db/client";
import { settings, sources, applications, emails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("db client", () => {
  it("creates schema on first open", () => {
    const db = openDb(":memory:");
    const settingsRows = db.select().from(settings).all();
    expect(settingsRows).toHaveLength(1);
    expect(settingsRows[0]?.scraperEnabled).toBe(0);
  });

  it("seeds source rows on first open", () => {
    const db = openDb(":memory:");
    const sourceRows = db.select().from(sources).all();
    expect(sourceRows.length).toBeGreaterThanOrEqual(4);
    expect(sourceRows.map((s) => s.name)).toContain("simplify_newgrad");
  });

  it("fresh DB accepts status='saved'", () => {
    const db = openDb(":memory:");
    const row = db.insert(applications).values({
      company: "Acme", role: "SWE", status: "saved", appliedAt: 1,
    }).returning().get();
    expect(row.status).toBe("saved");
  });

  it("rebuilds an existing DB whose CHECK predates 'saved', preserving rows and email links", () => {
    // Simulate a database created before "saved" existed: the old 5-value CHECK,
    // one application, and one email linked to it by FK.
    const dir = mkdtempSync(path.join(tmpdir(), "internpilot-migrate-"));
    const file = path.join(dir, "old.db");
    const raw = new Database(file);
    // Fixture only: better-sqlite3 enforces FKs by default, and the stub schema
    // below omits the jobs/resumes parent tables (openDb creates them later).
    raw.pragma("foreign_keys = OFF");
    raw.exec(`
      CREATE TABLE applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER REFERENCES jobs(id),
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        location TEXT,
        url TEXT,
        status TEXT NOT NULL CHECK (status IN ('applied','screen','interview','offer','rejected')),
        notes TEXT,
        applied_at INTEGER NOT NULL,
        last_email_at INTEGER,
        resume_id INTEGER REFERENCES resumes(id)
      );
      CREATE TABLE emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gmail_msg_id TEXT NOT NULL UNIQUE,
        thread_id TEXT, from_addr TEXT, subject TEXT, snippet TEXT,
        received_at INTEGER NOT NULL,
        classified_company TEXT, classified_status TEXT, confidence REAL,
        application_id INTEGER REFERENCES applications(id),
        classifier TEXT,
        needs_review INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO applications (id, company, role, status, notes, applied_at)
        VALUES (7, 'OldCo', 'Intern', 'interview', 'keep me', 100);
      INSERT INTO emails (gmail_msg_id, received_at, application_id) VALUES ('g1', 200, 7);
    `);
    // Sanity: the old constraint really does reject 'saved'.
    expect(() =>
      raw.prepare("INSERT INTO applications (company, role, status, applied_at) VALUES ('x','y','saved',1)").run(),
    ).toThrow(/CHECK/);
    raw.close();

    const db = openDb(file);

    // The live table definition now carries 'saved' … (inspect via a second
    // read-only handle; drizzle doesn't expose the underlying connection.)
    const inspect = new Database(file, { readonly: true });
    const def = inspect
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='applications'")
      .get() as { sql: string };
    inspect.close();
    expect(def.sql).toContain("'saved'");

    // … the pre-existing row survived with its id and fields intact …
    const kept = db.select().from(applications).where(eq(applications.id, 7)).get();
    expect(kept?.company).toBe("OldCo");
    expect(kept?.status).toBe("interview");
    expect(kept?.notes).toBe("keep me");

    // … its email link still resolves …
    const linked = db.select().from(emails).where(eq(emails.applicationId, 7)).get();
    expect(linked?.gmailMsgId).toBe("g1");

    // … and 'saved' is now accepted. AUTOINCREMENT continues past the old max id.
    const saved = db.insert(applications).values({
      company: "NewCo", role: "SWE", status: "saved", appliedAt: 300,
    }).returning().get();
    expect(saved.status).toBe("saved");
    expect(saved.id).toBeGreaterThan(7);
  });
});
