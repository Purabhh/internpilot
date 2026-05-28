export interface NormalizedJob {
  sourceId: string;
  company: string;
  role: string;
  location: string | null;
  url: string;
  postedAt: number | null;
}

export interface Scraper {
  name: string;
  fetchAndNormalize(httpFetch?: typeof fetch): Promise<NormalizedJob[]>;
}

export const HTTP_HEADERS = {
  "User-Agent": "internpilot/0.1 (personal)",
};

export const HTTP_TIMEOUT_MS = 60_000;

export async function fetchJson<T>(
  url: string,
  httpFetch: typeof fetch = fetch,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await httpFetch(url, { headers: HTTP_HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
