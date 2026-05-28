import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";

const patchSchema = z.object({
  scraperEnabled: z.union([z.literal(0), z.literal(1)]).optional(),
  trackerEnabled: z.union([z.literal(0), z.literal(1)]).optional(),
  scraperIntervalMin: z.number().int().min(1).max(1440).optional(),
  trackerIntervalMin: z.number().int().min(1).max(1440).optional(),
});

export async function GET() {
  const db = openDb(dbPath());
  return NextResponse.json(getSettings(db));
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const db = openDb(dbPath());
  return NextResponse.json(updateSettings(db, parsed.data));
}
