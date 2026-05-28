import { fetchJson, type NormalizedJob, type Scraper } from "./base";

// SimplifyJobs raw listing shape (verified against live URL 2026-05-27).
// Live keys: source, category, company_name, id, title, active, terms,
// date_updated, date_posted, url, locations, company_url, is_visible,
// sponsorship, degrees. We only read what we need.
interface SimplifyListing {
  id: string;
  company_name: string;
  title: string;
  locations: string[];
  url: string;
  active: boolean;
  is_visible: boolean;
  terms?: string[];
  season?: string;
  date_posted?: number;
}

function normalize(raw: SimplifyListing): NormalizedJob {
  return {
    sourceId: raw.id,
    company: raw.company_name,
    role: raw.title,
    location: raw.locations.length > 0 ? raw.locations.join("; ") : null,
    url: raw.url,
    postedAt: typeof raw.date_posted === "number" ? raw.date_posted : null,
  };
}

function isActiveVisible(r: SimplifyListing): boolean {
  return r.active === true && r.is_visible === true;
}

function isOffSeason(r: SimplifyListing): boolean {
  if (!r.terms || r.terms.length === 0) {
    return (r.season ?? "").toLowerCase() !== "summer";
  }
  return r.terms.some((t) => !/summer/i.test(t));
}

export class SimplifyOffSeasonScraper implements Scraper {
  readonly name = "simplify_summer26_offseason";
  constructor(private readonly url: string) {}

  async fetchAndNormalize(httpFetch: typeof fetch = fetch): Promise<NormalizedJob[]> {
    const all = await fetchJson<SimplifyListing[]>(this.url, httpFetch);
    return all.filter(isActiveVisible).filter(isOffSeason).map(normalize);
  }
}

export class SimplifyNewGradScraper implements Scraper {
  readonly name = "simplify_newgrad";
  constructor(private readonly url: string) {}

  async fetchAndNormalize(httpFetch: typeof fetch = fetch): Promise<NormalizedJob[]> {
    const all = await fetchJson<SimplifyListing[]>(this.url, httpFetch);
    return all.filter(isActiveVisible).map(normalize);
  }
}
