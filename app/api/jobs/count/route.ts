import { NextResponse } from "next/server";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { countJobs, type TermBucket } from "@/lib/db/queries/jobs";

const TERM_BUCKETS = new Set<TermBucket>(["summer", "fall", "winter", "spring", "newgrad"]);
function parseTermBucket(v: string | null): TermBucket | undefined {
  if (v && TERM_BUCKETS.has(v as TermBucket)) return v as TermBucket;
  return undefined;
}

/**
 * Returns the total number of jobs matching the same server-side filters as
 * /api/jobs (age + term + source + dismissal). The jobs list is paginated, so
 * the UI needs this to render an accurate "N matching" badge instead of just
 * counting the rows on the current page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeDismissed = url.searchParams.get("includeDismissed") === "1";
  const source = url.searchParams.get("source") ?? undefined;
  const maxAgeDaysRaw = url.searchParams.get("maxAgeDays");
  const maxAgeDays = maxAgeDaysRaw ? Number(maxAgeDaysRaw) : NaN;
  const postedAfter = Number.isFinite(maxAgeDays) && maxAgeDays > 0
    ? Math.floor(Date.now() / 1000) - maxAgeDays * 86400
    : undefined;
  const termBucket = parseTermBucket(url.searchParams.get("term"));
  const search = url.searchParams.get("q") ?? undefined;
  const minSalaryRaw = Number(url.searchParams.get("minSalary"));
  const minSalary = Number.isFinite(minSalaryRaw) && minSalaryRaw > 0 ? minSalaryRaw : undefined;
  const location = url.searchParams.get("loc") ?? undefined;
  const state = url.searchParams.get("state") ?? undefined;
  const remoteOnly = url.searchParams.get("remote") === "1";
  const db = openDb(dbPath());
  return NextResponse.json({
    total: countJobs(db, {
      includeDismissed, source, postedAfter, termBucket, search,
      minSalary, location, state, remoteOnly,
    }),
  });
}
