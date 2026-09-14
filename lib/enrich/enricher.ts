import { parseSalary, type SalaryParse } from "./salary-parse";

// Job-posting pages gate on a browser-ish User-Agent far more than the GitHub
// raw endpoints do, so the enricher uses its own header set rather than the
// scrapers' "internpilot/0.1" UA. Still no cookies/JS — this is a plain GET.
const ENRICH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

const ENRICH_TIMEOUT_MS = 20_000;
// Don't parse enormous pages — the pay figure, when present, is always in the
// first chunk of rendered text/JSON, and some career sites are multi-MB.
const MAX_BODY_CHARS = 500_000;

/**
 * Fetch one posting URL and try to extract its pay. Best-effort by design:
 * ANY failure (network error, non-OK status, timeout, blocked page) resolves
 * to null, which the caller records as a genuine "N/A" attempt. Never throws.
 */
export async function fetchSalary(
  url: string,
  httpFetch: typeof fetch = fetch,
): Promise<SalaryParse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);
  try {
    const res = await httpFetch(url, {
      headers: ENRICH_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const body = await res.text();
    return parseSalary(body.slice(0, MAX_BODY_CHARS));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
