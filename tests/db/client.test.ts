import { describe, it, expect } from "vitest";
import { openDb } from "@/lib/db/client";
import { settings, sources } from "@/lib/db/schema";

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
});
