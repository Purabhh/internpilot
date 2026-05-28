import { describe, it, expect } from "vitest";
import { SpeedySweScraper } from "@/lib/scrapers/github-speedy";

describe("SpeedySweScraper (stub)", () => {
  it("returns empty list until markdown parser is implemented", async () => {
    const s = new SpeedySweScraper("https://example/anything");
    const jobs = await s.fetchAndNormalize();
    expect(jobs).toEqual([]);
  });
});
