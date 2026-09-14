import { describe, it, expect } from "vitest";
import { parseMarkdownTable } from "@/lib/scrapers/markdown-table";
import { normalizeJobrightRows, parsePostedAt, JobrightScraper } from "@/lib/scrapers/github-jobright";

const README = `# 2026 SWE Internships

Some intro text.

| Company | Job Title | Location | Work Model | Date Posted |
| ----- | --------- |  --------- | ---- | ------- |
| **[TikTok](https://www.tiktok.com)** | **[Software Engineer Intern (2026 Summer)](https://jobright.ai/jobs/info/abc123?utm_campaign=1&utm_source=git)** | San Jose | On Site | Jun 25 |
| ↳ | **[Backend Intern (Fall 2026)](https://jobright.ai/jobs/info/def456?utm_source=git)** | Remote in USA | Remote | Jun 24 |
| **[Cerebras](https://cerebras.ai)** | **[Software Engineer Internship](https://jobright.ai/jobs/info/ghi789)** | Sunnyvale, CA | Hybrid | Jun 23 |
| **[NoLink Co](https://x.com)** | Plain text title, no link | NYC | Remote | Jun 22 |
`;

describe("parseMarkdownTable", () => {
  it("returns data rows without the header or separator", () => {
    const rows = parseMarkdownTable(README);
    expect(rows).toHaveLength(4);
    expect(rows[0]![0]).toContain("TikTok");
    expect(rows[0]).toHaveLength(5);
  });

  it("returns [] when there is no table", () => {
    expect(parseMarkdownTable("# Just a heading\n\nno table here")).toEqual([]);
  });
});

describe("normalizeJobrightRows", () => {
  const now = new Date("2026-06-26T12:00:00Z");
  const jobs = normalizeJobrightRows(parseMarkdownTable(README), now);

  it("parses company, role, location, and the jobright id as sourceId", () => {
    const tt = jobs.find((j) => j.sourceId === "abc123")!;
    expect(tt.company).toBe("TikTok");
    expect(tt.role).toBe("Software Engineer Intern"); // parenthetical stripped
    expect(tt.location).toBe("San Jose");
    expect(tt.url).toBe("https://jobright.ai/jobs/info/abc123"); // utm stripped
  });

  it("extracts season terms from the title parentheticals", () => {
    expect(jobs.find((j) => j.sourceId === "abc123")!.terms).toEqual(["2026 Summer"]);
    expect(jobs.find((j) => j.sourceId === "def456")!.terms).toEqual(["Fall 2026"]);
    expect(jobs.find((j) => j.sourceId === "ghi789")!.terms).toBeNull();
  });

  it("carries the company forward across ↳ continuation rows", () => {
    expect(jobs.find((j) => j.sourceId === "def456")!.company).toBe("TikTok");
  });

  it("skips rows whose title cell has no markdown link", () => {
    expect(jobs.map((j) => j.sourceId)).toEqual(["abc123", "def456", "ghi789"]);
  });

  it("unescapes markdown punctuation in the role", () => {
    const rows = parseMarkdownTable(
      `| Co | Title | Loc | M | D |\n| - | - | - | - | - |\n` +
      `| **[Acme](https://a.co)** | **[Tech \\/ AI Intern](https://jobright.ai/jobs/info/zzz)** | NYC | Remote | Jun 1 |\n`,
    );
    expect(normalizeJobrightRows(rows, now)[0]!.role).toBe("Tech / AI Intern");
  });
});

describe("parsePostedAt", () => {
  const now = new Date("2026-06-26T12:00:00Z");

  it("parses 'Mon DD' to unix seconds in the current year", () => {
    const got = parsePostedAt("Jun 25", now);
    expect(got).toBe(Math.floor(new Date(2026, 5, 25).getTime() / 1000));
  });

  it("rolls a future month back to last year", () => {
    // Scraping in June, a "Dec 20" posting must be last December, not this one.
    const got = parsePostedAt("Dec 20", now);
    expect(got).toBe(Math.floor(new Date(2025, 11, 20).getTime() / 1000));
  });

  it("returns null for unparseable dates", () => {
    expect(parsePostedAt("yesterday", now)).toBeNull();
    expect(parsePostedAt("", now)).toBeNull();
  });
});

describe("JobrightScraper.fetchAndNormalize", () => {
  it("fetches the README and returns normalized jobs", async () => {
    const fakeFetch = (async () =>
      ({ ok: true, text: async () => README }) as unknown as Response) as typeof fetch;
    const scraper = new JobrightScraper("jobright_test", "https://example/readme.md");
    const jobs = await scraper.fetchAndNormalize(fakeFetch);
    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => j.url.startsWith("https://jobright.ai/jobs/info/"))).toBe(true);
  });

  it("throws on a non-OK response", async () => {
    const fakeFetch = (async () =>
      ({ ok: false, status: 404, statusText: "Not Found" }) as unknown as Response) as typeof fetch;
    const scraper = new JobrightScraper("jobright_test", "https://example/readme.md");
    await expect(scraper.fetchAndNormalize(fakeFetch)).rejects.toThrow("HTTP 404");
  });
});
