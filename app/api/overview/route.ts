import { NextResponse } from "next/server";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { getOverview } from "@/lib/db/queries/overview";

export async function GET() {
  const db = openDb(dbPath());
  return NextResponse.json(getOverview(db));
}
