// Derive a short ATS badge from a job URL hostname.
export function atsFromUrl(url: string | null | undefined): { code: string; full: string } {
  if (!url) return { code: "DIR", full: "Direct" };
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { code: "DIR", full: "Direct" };
  }
  if (host.includes("greenhouse.io")) return { code: "GH", full: "Greenhouse" };
  if (host.includes("lever.co")) return { code: "LV", full: "Lever" };
  if (host.includes("ashby.com") || host.includes("ashbyhq.com")) return { code: "AS", full: "Ashby" };
  if (host.includes("myworkdayjobs.com") || host.includes("workday")) return { code: "WD", full: "Workday" };
  if (host.includes("linkedin.com")) return { code: "LI", full: "LinkedIn" };
  if (host.includes("simplify.jobs")) return { code: "SJ", full: "Simplify" };
  if (host.includes("jobright.ai")) return { code: "JR", full: "Jobright" };
  return { code: "DIR", full: "Direct" };
}

export function relativeTime(unixSec: number | null | undefined): string {
  if (!unixSec) return "—";
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  // Keep hour granularity up to 72h — the first 1-2 days of a posting matter
  // a lot when timing your application, so "30h ago" beats "1d ago".
  if (diff < 86400 * 3) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / (86400 * 30))}mo ago`;
}

export function daysSince(unixSec: number | null | undefined): string {
  if (!unixSec) return "—";
  const days = Math.floor((Date.now() / 1000 - unixSec) / 86400);
  return days === 0 ? "today" : `${days}d`;
}

export function parseTerms(termsJson: string | null | undefined): string[] {
  if (!termsJson) return [];
  try {
    const parsed = JSON.parse(termsJson) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Categorize a term string into a coarse bucket the UI can color/filter by.
 * "Summer 2026" → "summer", "Fall 2026" → "fall", "New Grad" → "newgrad", etc.
 */
export function termBucket(term: string): "summer" | "fall" | "winter" | "spring" | "newgrad" | "other" {
  const t = term.toLowerCase();
  if (t.includes("new grad")) return "newgrad";
  if (t.includes("summer")) return "summer";
  if (t.includes("fall") || t.includes("autumn")) return "fall";
  if (t.includes("winter")) return "winter";
  if (t.includes("spring")) return "spring";
  return "other";
}

/** "$120k" for 120000, "$1.2M" for 1_200_000. Compact annual figure. */
export function formatAnnual(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `$${Math.round(n / 1000)}k`;
}

/**
 * Compact annualized pay label for the salary column, e.g. "$120k–$150k" or
 * "$140k". Returns null when the job has no salary (renders as "N/A" in the UI).
 */
export function formatSalaryRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null || max == null) return null;
  return min === max ? formatAnnual(max) : `${formatAnnual(min)}–${formatAnnual(max)}`;
}

/**
 * True when the timestamp is within the last 6 hours — used to surface a "NEW"
 * badge in the jobs list so the user can hit fresh postings before everyone else.
 */
export function isFresh(unixSec: number | null | undefined, withinHours = 6): boolean {
  if (!unixSec) return false;
  return Date.now() / 1000 - unixSec < withinHours * 3600;
}
