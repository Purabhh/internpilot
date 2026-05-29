import { describe, it, expect } from "vitest";
import type { NormalizedJob, Scraper } from "@/lib/scrapers/base";

describe("scraper base", () => {
  it("NormalizedJob has the expected shape", () => {
    const j: NormalizedJob = {
      sourceId: "x",
      company: "C",
      role: "R",
      location: null,
      url: "https://x",
      postedAt: 1,
      terms: null,
    };
    expect(j.company).toBe("C");
  });

  it("Scraper interface defines fetchAndNormalize", () => {
    const fake: Scraper = {
      name: "fake",
      async fetchAndNormalize() {
        return [];
      },
    };
    expect(fake.name).toBe("fake");
  });
});
