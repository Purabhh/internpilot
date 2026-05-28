import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { listSources, setSourceEnabled } from "@/lib/db/queries/sources";

const patchSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
});

export async function GET() {
  const db = openDb(dbPath());
  return NextResponse.json(listSources(db));
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const db = openDb(dbPath());
  const row = setSourceEnabled(db, parsed.data.name, parsed.data.enabled);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(row);
}
