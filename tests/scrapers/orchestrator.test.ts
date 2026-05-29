import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { runScrapers } from "@/lib/scrapers";
import type { Scraper, NormalizedJob } from "@/lib/scrapers/base";
import { jobs, sources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

class FakeScraper implements Scraper {
  constructor(public name: string, public out: NormalizedJob[], public throws?: Error) {}
  async fetchAndNormalize() {
    if (this.throws) throw this.throws;
    return this.out;
  }
}

describe("runScrapers", () => {
  it("only runs enabled sources", async () => {
    const db = freshDb();
    db.update(sources).set({ enabled: 0 }).where(eq(sources.name, "simplify_newgrad")).run();
    const fakes = [
      new FakeScraper("simplify_summer26_offseason", [
        { sourceId: "a", company: "Co", role: "R", location: null, url: "u", postedAt: null, terms: null },
      ]),
      new FakeScraper("simplify_newgrad", [
        { sourceId: "b", company: "Co2", role: "R", location: null, url: "u", postedAt: null, terms: null },
      ]),
    ];
    await runScrapers(db, fakes);
    const rows = db.select().from(jobs).all();
    expect(rows.find((j) => j.sourceId === "a")).toBeDefined();
    expect(rows.find((j) => j.sourceId === "b")).toBeUndefined();
  });

  it("upserts on (source, sourceId) — running twice produces no duplicates", async () => {
    const db = freshDb();
    const fake = new FakeScraper("simplify_newgrad", [
      { sourceId: "x", company: "C", role: "R", location: null, url: "u", postedAt: null, terms: null },
    ]);
    await runScrapers(db, [fake]);
    await runScrapers(db, [fake]);
    const rows = db.select().from(jobs).all();
    expect(rows.filter((j) => j.sourceId === "x")).toHaveLength(1);
  });

  it("records last_run_at and last_count on success", async () => {
    const db = freshDb();
    const before = Math.floor(Date.now() / 1000) - 1;
    const fake = new FakeScraper("simplify_newgrad", [
      { sourceId: "x", company: "C", role: "R", location: null, url: "u", postedAt: null, terms: null },
      { sourceId: "y", company: "C2", role: "R", location: null, url: "u", postedAt: null, terms: null },
    ]);
    await runScrapers(db, [fake]);
    const row = db.select().from(sources).where(eq(sources.name, "simplify_newgrad")).get();
    expect(row?.lastCount).toBe(2);
    expect(row?.lastRunAt).toBeGreaterThanOrEqual(before);
    expect(row?.lastError).toBeNull();
  });

  it("records last_error on failure and continues other sources", async () => {
    const db = freshDb();
    const fakes = [
      new FakeScraper("simplify_summer26_offseason", [], new Error("boom")),
      new FakeScraper("simplify_newgrad", [
        { sourceId: "a", company: "C", role: "R", location: null, url: "u", postedAt: null, terms: null },
      ]),
    ];
    await runScrapers(db, fakes);
    const off = db.select().from(sources).where(eq(sources.name, "simplify_summer26_offseason")).get();
    const ng = db.select().from(sources).where(eq(sources.name, "simplify_newgrad")).get();
    expect(off?.lastError).toContain("boom");
    expect(ng?.lastError).toBeNull();
    expect(db.select().from(jobs).all()).toHaveLength(1);
  });
});
