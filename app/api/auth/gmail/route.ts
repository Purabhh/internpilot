import { NextResponse } from "next/server";
import { loadOAuthClient, getAuthUrl } from "@/lib/tracker/gmail-client";

export async function GET() {
  try {
    const client = loadOAuthClient();
    const url = getAuthUrl(client);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
