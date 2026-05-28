import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SimplifyOffSeasonScraper, SimplifyNewGradScraper } from "@/lib/scrapers/github-simplify";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/simplify-listings.sample.json"), "utf-8"),
);

function fakeFetch(payload: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
}

describe("SimplifyOffSeasonScraper", () => {
  it("filters out inactive and invisible listings", async () => {
    const s = new SimplifyOffSeasonScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    expect(jobs.find((j) => j.company === "DRW")).toBeUndefined();
    expect(jobs.find((j) => j.company === "Hidden Co")).toBeUndefined();
  });

  it("keeps only listings whose terms include a non-Summer term", async () => {
    const s = new SimplifyOffSeasonScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    expect(jobs.find((j) => j.company === "Citadel")).toBeDefined();
    expect(jobs.find((j) => j.company === "Jane Street")).toBeUndefined();
  });

  it("normalizes location array to comma-joined string or null", async () => {
    const s = new SimplifyOffSeasonScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    const citadel = jobs.find((j) => j.company === "Citadel");
    expect(citadel?.location).toBe("New York, NY");
  });
});

describe("SimplifyNewGradScraper", () => {
  it("does not filter by term — all active+visible roles included", async () => {
    const s = new SimplifyNewGradScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    expect(jobs.map((j) => j.company)).toEqual(
      expect.arrayContaining(["Citadel", "Jane Street"]),
    );
    expect(jobs.find((j) => j.company === "DRW")).toBeUndefined();
  });
});
