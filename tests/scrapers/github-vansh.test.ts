import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { VanshOffSeasonScraper } from "@/lib/scrapers/github-vansh";

const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/vansh-listings.sample.json"), "utf-8"),
);

function fakeFetch(payload: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch;
}

describe("VanshOffSeasonScraper", () => {
  it("filters out inactive listings", async () => {
    const s = new VanshOffSeasonScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    expect(jobs.find((j) => j.company === "DRW")).toBeUndefined();
  });

  it("keeps only non-Summer season listings", async () => {
    const s = new VanshOffSeasonScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    expect(jobs.find((j) => j.company === "Rippling")).toBeDefined();
    expect(jobs.find((j) => j.company === "Jane Street")).toBeUndefined();
  });

  it("joins locations array; null when empty", async () => {
    const s = new VanshOffSeasonScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    const rip = jobs.find((j) => j.company === "Rippling");
    expect(rip?.location).toBe("New York, NY; San Francisco, CA");
    const rf = jobs.find((j) => j.company === "RemoteFirst");
    expect(rf?.location).toBeNull();
  });

  it("sets sourceId from id field", async () => {
    const s = new VanshOffSeasonScraper("https://test/listings.json");
    const jobs = await s.fetchAndNormalize(fakeFetch(fixture));
    expect(jobs.find((j) => j.sourceId === "rip-fe-winter")).toBeDefined();
  });
});
