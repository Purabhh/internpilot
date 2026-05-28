import type { NormalizedJob, Scraper } from "./base";

// STUB: speedyapply does not publish a JSON listings file — only markdown
// tables in README files (verified 2026-05-27). A markdown-table parser is
// deferred. This scraper returns an empty list so the orchestrator can call
// it without error; the source is also seeded with enabled=0 in lib/db/client.ts
// to keep it from running by default.
export class SpeedySweScraper implements Scraper {
  readonly name = "speedyapply_swe26";
  constructor(private readonly _url: string) {}

  async fetchAndNormalize(_httpFetch: typeof fetch = fetch): Promise<NormalizedJob[]> {
    return [];
  }
}
