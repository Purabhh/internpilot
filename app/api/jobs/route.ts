import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { listJobs, createManualJob } from "@/lib/db/queries/jobs";

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
  const db = openDb(dbPath());
  return NextResponse.json(listJobs(db, { includeDismissed, source, limit, offset }));
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
