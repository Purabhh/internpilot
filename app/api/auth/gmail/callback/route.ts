import { NextResponse } from "next/server";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { loadOAuthClient, exchangeCode } from "@/lib/tracker/gmail-client";
import { updateSettings } from "@/lib/db/queries/settings";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const client = loadOAuthClient();
  await exchangeCode(client, code);
  const db = openDb(dbPath());
  updateSettings(db, { gmailConnectedAt: Math.floor(Date.now() / 1000) });
  return NextResponse.redirect(new URL("/?gmail=connected", req.url));
}
