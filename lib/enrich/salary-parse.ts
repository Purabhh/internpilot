/**
 * Best-effort salary extraction from a job posting's page text.
 *
 * Pure and I/O-free so it's directly unit-testable: `fetchSalary` (in
 * enricher.ts) hands us the fetched page text and we return a normalized
 * result or null. We do NOT try to be clever per-ATS here — Greenhouse,
 * Lever, and Ashby all render the pay string (or embed it in inline JSON)
 * into the HTML we fetch, so a single robust text scan covers them. Pages
 * that hide comp or block scraping (LinkedIn, Workday, many redirects) simply
 * yield null, which the caller records as a genuine "N/A".
 */

/** Hours in a work-year (40h x 52w) and months in a year, for annualizing. */
const HOURS_PER_YEAR = 2080;
const MONTHS_PER_YEAR = 12;

export interface SalaryParse {
  /** The pay text exactly as matched on the page, for display (e.g. "$45/hr"). */
  raw: string;
  /** Annualized floor of the range (== max when a single value). */
  min: number;
  /** Annualized ceiling of the range (== min when a single value). */
  max: number;
}

type Unit = "hour" | "month" | "year";

/** A currency amount: "120,000" -> 120000, with optional "k" -> x1000. */
function parseAmount(digits: string, k: string | undefined): number | null {
  const n = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return k ? Math.round(n * 1000) : Math.round(n);
}

/**
 * Decide the pay unit from a snippet of text that follows the amount(s), plus
 * the raw magnitude as a fallback. Explicit words win; otherwise a small number
 * (< 2000) is treated as hourly and a large one as annual — monthly figures in
 * the wild are effectively always written with an explicit "/month".
 */
function detectUnit(trailing: string, sampleValue: number): Unit {
  const t = trailing.toLowerCase();
  if (/\/\s*h|per\s*hour|hourly|an\s*hour|\bhr\b|\bhour\b/.test(t)) return "hour";
  if (/\/\s*mo|per\s*month|monthly|a\s*month|\bmonth\b/.test(t)) return "month";
  if (/\/\s*y|per\s*year|per\s*annum|annually|annual|a\s*year|\byr\b|\byear\b/.test(t)) return "year";
  return sampleValue < 2000 ? "hour" : "year";
}

function annualize(value: number, unit: Unit): number {
  if (unit === "hour") return Math.round(value * HOURS_PER_YEAR);
  if (unit === "month") return Math.round(value * MONTHS_PER_YEAR);
  return value;
}

// A single "$120,000" / "$120k" / "$45.50" amount. Capture groups: digits, k-flag.
const AMOUNT = String.raw`\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?([kK])?`;
// A range: amount, then a dash/"to", then a second amount.
const RANGE_RE = new RegExp(`${AMOUNT}\\s?(?:-|–|—|to)\\s?${AMOUNT}`);
const SINGLE_RE = new RegExp(AMOUNT);
// How much text after the match to inspect for a unit word.
const TRAILING_WINDOW = 24;

/**
 * Scan page text for the first salary-looking figure. Prefers an explicit
 * range ("$120k - $150k"); falls back to a single amount ("$120,000/yr").
 * Returns null when nothing plausible is found.
 */
export function parseSalary(pageText: string): SalaryParse | null {
  if (!pageText) return null;
  // Collapse whitespace so "$120,000\n  per year" reads as one line.
  const text = pageText.replace(/\s+/g, " ");

  const range = matchRange(text);
  if (range) return range;
  return matchSingle(text);
}

function matchRange(text: string): SalaryParse | null {
  const m = RANGE_RE.exec(text);
  if (!m) return null;
  const lo = parseAmount(m[1]!, m[2]);
  const hi = parseAmount(m[3]!, m[4]);
  if (lo === null || hi === null) return null;
  const trailing = text.slice(m.index + m[0].length, m.index + m[0].length + TRAILING_WINDOW);
  // Use the larger raw value to pick the unit (more stable for magnitude fallback).
  const unit = detectUnit(trailing, Math.max(lo, hi));
  const min = annualize(Math.min(lo, hi), unit);
  const max = annualize(Math.max(lo, hi), unit);
  if (!plausibleAnnual(min) || !plausibleAnnual(max)) return null;
  return { raw: m[0].trim(), min, max };
}

function matchSingle(text: string): SalaryParse | null {
  const m = SINGLE_RE.exec(text);
  if (!m) return null;
  const val = parseAmount(m[1]!, m[2]);
  if (val === null) return null;
  const trailing = text.slice(m.index + m[0].length, m.index + m[0].length + TRAILING_WINDOW);
  const unit = detectUnit(trailing, val);
  const annual = annualize(val, unit);
  if (!plausibleAnnual(annual)) return null;
  return { raw: m[0].trim(), min: annual, max: annual };
}

/**
 * Guard against garbage: a real annual comp for these roles sits roughly
 * between $20k and $1M. This rejects things like a "$5" price or a "$5,000,000"
 * funding figure that happen to appear in page chrome.
 */
function plausibleAnnual(annual: number): boolean {
  return annual >= 20_000 && annual <= 1_000_000;
}
