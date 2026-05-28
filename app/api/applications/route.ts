import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { listApplications, createApplication } from "@/lib/db/queries/applications";

const postSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  location: z.string().optional(),
  url: z.string().url().optional(),
  resumeId: z.number().int().positive().optional(),
});

const STATUSES = ["applied", "screen", "interview", "offer", "rejected"] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = STATUSES.find((s) => s === statusParam);
  const db = openDb(dbPath());
  return NextResponse.json(listApplications(db, { status }));
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const db = openDb(dbPath());
  const app = createApplication(db, parsed.data);
  return NextResponse.json(app, { status: 201 });
}
