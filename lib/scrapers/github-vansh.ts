import { fetchJson, type NormalizedJob, type Scraper } from "./base";

// vanshb03 raw listing shape (verified against live URL 2026-05-27).
// Differs from SimplifyJobs: uses single `season` string instead of `terms`
// array, and has no `is_visible` field (all entries assumed visible).
interface VanshListing {
  id: string;
  company_name: string;
  title: string;
  locations: string[];
  url: string;
  active: boolean;
  season?: string;
  date_posted?: number;
}

function normalize(raw: VanshListing): NormalizedJob {
  return {
    sourceId: raw.id,
    company: raw.company_name,
    role: raw.title,
    location: raw.locations.length > 0 ? raw.locations.join("; ") : null,
    url: raw.url,
    postedAt: typeof raw.date_posted === "number" ? raw.date_posted : null,
    terms: raw.season ? [raw.season] : null,
  };
}

function isOffSeason(r: VanshListing): boolean {
  return (r.season ?? "").toLowerCase() !== "summer";
}

export class VanshOffSeasonScraper implements Scraper {
  readonly name = "vansh_summer27_offseason";
  constructor(private readonly url: string) {}

  async fetchAndNormalize(httpFetch: typeof fetch = fetch): Promise<NormalizedJob[]> {
    const all = await fetchJson<VanshListing[]>(this.url, httpFetch);
    return all.filter((r) => r.active).filter(isOffSeason).map(normalize);
  }
}
