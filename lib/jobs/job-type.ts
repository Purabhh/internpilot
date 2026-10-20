/**
 * Internship vs new grad, decided per posting. Pure TS (no Node imports) so
 * the jobs page badge and the server-side "type" filter agree.
 *
 * The aggregator feeds can't be trusted on their own: Simplify's new-grad
 * list tags every row "New Grad" even when the title says "Software
 * Engineer - Intern", so the title wins over the source.
 */

export type JobType = "internship" | "newgrad";

export const JOB_TYPE_LABEL: Record<JobType, string> = {
  internship: "Internship",
  newgrad: "New grad",
};

/** Feeds whose rows are new grad / full-time unless the title says otherwise. */
const NEWGRAD_SOURCES = new Set(["simplify_newgrad", "jobright_swe_newgrad"]);

/** Feeds whose rows are internships unless the title says otherwise. */
const INTERNSHIP_SOURCES = new Set([
  "simplify_summer26_offseason",
  "vansh_summer27_offseason",
  "jobright_swe_internship",
]);

/**
 * "Intern", "Internship", "Co-op", "Coop", "Apprenticeship", plus grad-school
 * student jobs ("Graduate Assistant", "Graduate Student") — not "Internal" or
 * "International".
 */
const INTERN_TITLE_RE =
  /(?:^|[^a-z])(?:intern(?:ship)?s?|co-?ops?|apprentice(?:ship)?s?|graduate (?:research |teaching )?assistant|graduate students?)(?:$|[^a-z])/i;

/** Titles that clearly mean a full-time early-career hire. */
const NEWGRAD_TITLE_RE =
  /(?:^|[^a-z])(?:new grad(?:uate)?|new college grad(?:uate)?|university grad(?:uate)?|graduate|early career|entry[- ]level|campus)(?:$|[^a-z])/i;

const SEASON_RE = /\b(?:summer|fall|autumn|winter|spring)\b/i;

export interface TypedJobFields {
  role: string;
  source: string;
  /** JSON-encoded array of term strings, as stored on the jobs row. */
  terms: string | null;
}

function parseTermsJson(terms: string | null): string[] {
  if (!terms) return [];
  try {
    const v = JSON.parse(terms) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function jobType(job: TypedJobFields): JobType {
  // 1. The title is the most reliable signal.
  if (INTERN_TITLE_RE.test(job.role)) return "internship";
  if (NEWGRAD_TITLE_RE.test(job.role)) return "newgrad";
  // 2. Then which feed it came from. On new-grad feeds a season tag like
  //    "Fall 2026" is a start date, not an internship term.
  if (NEWGRAD_SOURCES.has(job.source)) return "newgrad";
  if (INTERNSHIP_SOURCES.has(job.source)) return "internship";
  // 3. Manually added or unknown feeds: go by the tags.
  const terms = parseTermsJson(job.terms);
  if (terms.some((t) => /new grad/i.test(t))) return "newgrad";
  if (terms.some((t) => SEASON_RE.test(t))) return "internship";
  // New-grad feeds, manually added jobs and anything unknown: a full-time role.
  return "newgrad";
}
