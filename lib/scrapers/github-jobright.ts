import { type NormalizedJob, type Scraper, HTTP_HEADERS, HTTP_TIMEOUT_MS } from "./base";
import { parseMarkdownTable } from "./markdown-table";

// Jobright README rows look like:
//   | **[Company](co_url)** | **[Title (Fall 26)](jobright_url)** | Loc | Model | Jun 25 |
// Continuation rows for the same company use "↳" in the company cell.

const MD_LINK = /\[([^\]]+)\]\(([^)]+)\)/;
const SEASON_RE = /\b(summer|fall|autumn|winter|spring|new\s*grad)\b/i;
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseLink(cell: string): { text: string; url: string } | null {
  const m = cell.match(MD_LINK);
  return m ? { text: m[1]!.trim(), url: m[2]!.trim() } : null;
}

/** The stable id baked into a jobright apply URL: .../jobs/info/<id>?utm=... */
function jobrightId(url: string): string | null {
  const m = url.match(/jobright\.ai\/jobs\/info\/([A-Za-z0-9]+)/);
  return m ? m[1]! : null;
}

/** Pull season/new-grad terms out of the title's parentheticals. */
function extractTerms(title: string): string[] | null {
  const terms: string[] = [];
  for (const m of title.matchAll(/\(([^)]+)\)/g)) {
    if (SEASON_RE.test(m[1]!)) terms.push(m[1]!.trim());
  }
  return terms.length > 0 ? terms : null;
}

/** Drop all parentheticals from the title and unescape markdown punctuation
 *  (e.g. "Technology \/ AI" -> "Technology / AI") to get a clean role string. */
function cleanRole(title: string): string {
  return title
    .replace(/\\([^\w\s])/g, "$1") // unescape \/ \& \( etc.
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse a "Jun 25"-style date to unix seconds, assuming the most recent
 * occurrence (a month in the future means last year). Returns null on anything
 * unparseable — the UI falls back to scrapedAt.
 */
export function parsePostedAt(cell: string, now: Date): number | null {
  const m = cell.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!m) return null;
  const mon = MONTHS[m[1]!.toLowerCase()];
  if (mon === undefined) return null;
  const day = Number(m[2]);
  let d = new Date(now.getFullYear(), mon, day);
  if (d.getTime() > now.getTime() + 86_400_000) d = new Date(now.getFullYear() - 1, mon, day);
  return Math.floor(d.getTime() / 1000);
}

/**
 * Turn a parsed markdown table into normalized jobs. Pure (no I/O) so it's
 * directly unit-testable; `fetchAndNormalize` just feeds it the README text.
 */
export function normalizeJobrightRows(rows: string[][], now: Date = new Date()): NormalizedJob[] {
  const out: NormalizedJob[] = [];
  let lastCompany: string | null = null;
  for (const cols of rows) {
    if (cols.length < 2) continue;
    const companyLink = parseLink(cols[0] ?? "");
    // Carry the company forward on "↳" continuation rows.
    const company: string | null = companyLink?.text ?? (cols[0]?.includes("↳") ? lastCompany : null);
    if (!company) continue;
    lastCompany = company;

    const titleLink = parseLink(cols[1] ?? "");
    if (!titleLink) continue;
    const id = jobrightId(titleLink.url);
    if (!id) continue;

    const location = (cols[2] ?? "").trim();
    out.push({
      sourceId: id,
      company,
      role: cleanRole(titleLink.text),
      location: location.length > 0 ? location : null,
      url: titleLink.url.split("?")[0]!, // strip utm tracking params
      postedAt: parsePostedAt(cols[4] ?? "", now),
      terms: extractTerms(titleLink.text),
    });
  }
  return out;
}

/** Scrapes one Jobright category README (markdown table → normalized jobs). */
export class JobrightScraper implements Scraper {
  constructor(readonly name: string, private readonly url: string) {}

  async fetchAndNormalize(httpFetch: typeof fetch = fetch): Promise<NormalizedJob[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let md: string;
    try {
      const res = await httpFetch(this.url, { headers: HTTP_HEADERS, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      md = await res.text();
    } finally {
      clearTimeout(timer);
    }
    return normalizeJobrightRows(parseMarkdownTable(md));
  }
}
