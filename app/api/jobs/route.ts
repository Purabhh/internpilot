import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { listJobs, createManualJob, type TermBucket } from "@/lib/db/queries/jobs";

const TERM_BUCKETS = new Set<TermBucket>(["summer", "fall", "winter", "spring", "newgrad"]);
function parseTermBucket(v: string | null): TermBucket | undefined {
  if (v && TERM_BUCKETS.has(v as TermBucket)) return v as TermBucket;
  return undefined;
}

const postSchema = z.object({
  url: z.string().url(),
  company: z.string().min(1),
  role: z.string().min(1),
  location: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeDismissed = url.searchParams.get("includeDismissed") === "1";
  const source = url.searchParams.get("source") ?? undefined;
  const limit = Number(url.searchParams.get("limit")) || 100;
  const offset = Number(url.searchParams.get("offset")) || 0;
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
  const niche = url.searchParams.get("niche") === "1";
  const typeRaw = url.searchParams.get("type");
  const type = typeRaw === "internship" || typeRaw === "newgrad" ? typeRaw : undefined;
  const db = openDb(dbPath());
  return NextResponse.json(
    listJobs(db, {
      includeDismissed, source, limit, offset, postedAfter, termBucket, search,
      minSalary, location, state, remoteOnly, niche, type,
    }),
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const db = openDb(dbPath());
  const job = createManualJob(db, {
    source: "manual",
    sourceId: randomUUID(),
    company: parsed.data.company,
    role: parsed.data.role,
    location: parsed.data.location ?? null,
    url: parsed.data.url,
    postedAt: null,
  });
  return NextResponse.json(job, { status: 201 });
}
