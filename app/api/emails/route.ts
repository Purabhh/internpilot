import { NextResponse } from "next/server";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { listEmails } from "@/lib/db/queries/emails";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit")) || 50;
  const offset = Number(url.searchParams.get("offset")) || 0;
  const db = openDb(dbPath());
  return NextResponse.json(listEmails(db, { limit, offset }));
}
