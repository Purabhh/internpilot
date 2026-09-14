import { NextResponse } from "next/server";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { countEmails } from "@/lib/db/queries/emails";

/** Returns { total, needsReview } so the emails page can paginate and the
 *  navbar can render a count without fetching every email row. */
export async function GET() {
  const db = openDb(dbPath());
  return NextResponse.json(countEmails(db));
}
