import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";
import type { DB } from "@/lib/db/client";
import { credentialsPath, gmailTokenPath } from "@/lib/paths";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import type { IncomingMessage } from "./pipeline";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

// Hardcoded — must match the Next.js OAuth callback route. For Desktop-type
// OAuth clients, Google auto-allows any http://localhost:*/ path, so this does
// NOT need to be added to "Authorized redirect URIs" in Google Cloud Console.
// The redirect_uris field in credentials.json is intentionally ignored — it's
// typically just "http://localhost" with no port/path.
const OAUTH_REDIRECT_URI = "http://localhost:3000/api/auth/gmail/callback";

interface GoogleCredentials {
  installed: { client_id: string; client_secret: string; redirect_uris: string[] };
}

export function readToken(p: string): Credentials | null {
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as Credentials;
}

export function writeToken(p: string, creds: Credentials): void {
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(creds, null, 2));
}

export function loadOAuthClient(): OAuth2Client {
  const credsJson = JSON.parse(readFileSync(credentialsPath(), "utf-8")) as GoogleCredentials;
  const { client_id, client_secret } = credsJson.installed;
  const client = new google.auth.OAuth2(client_id, client_secret, OAUTH_REDIRECT_URI);
  const existing = readToken(gmailTokenPath());
  if (existing) client.setCredentials(existing);
  client.on("tokens", (newCreds: Credentials) => {
    const merged = { ...readToken(gmailTokenPath()), ...newCreds };
    writeToken(gmailTokenPath(), merged);
  });
  return client;
}

export function getAuthUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });
}

export async function exchangeCode(client: OAuth2Client, code: string): Promise<void> {
  const { tokens } = await client.getToken(code);
  writeToken(gmailTokenPath(), tokens);
  client.setCredentials(tokens);
}

export async function fetchNewMessages(
  db: DB,
  client: OAuth2Client,
): Promise<IncomingMessage[]> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const settings = getSettings(db);

  let messageIds: string[] = [];
  if (settings.gmailHistoryId) {
    try {
      const hist = await gmail.users.history.list({
        userId: "me",
        startHistoryId: settings.gmailHistoryId,
        historyTypes: ["messageAdded"],
      });
      messageIds = (hist.data.history ?? [])
        .flatMap((h) => (h.messagesAdded ?? []).map((m) => m.message?.id))
        .filter((x): x is string => !!x);
      const newHistoryId = hist.data.historyId;
      if (newHistoryId) updateSettings(db, { gmailHistoryId: newHistoryId });
    } catch {
      messageIds = [];
    }
  }

  if (messageIds.length === 0) {
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 25,
      q: "in:inbox newer_than:7d",
    });
    messageIds = (list.data.messages ?? []).map((m) => m.id).filter((x): x is string => !!x);
    const profile = await gmail.users.getProfile({ userId: "me" });
    if (profile.data.historyId) updateSettings(db, { gmailHistoryId: profile.data.historyId });
  }

  const out: IncomingMessage[] = [];
  for (const id of messageIds) {
    const m = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    const headers = m.data.payload?.headers ?? [];
    const from = headers.find((h) => h.name === "From")?.value ?? "";
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
    const date = headers.find((h) => h.name === "Date")?.value ?? "";
    const receivedAt = date ? Math.floor(new Date(date).getTime() / 1000) : Math.floor(Date.now() / 1000);
    out.push({
      gmailMsgId: m.data.id ?? id,
      threadId: m.data.threadId ?? null,
      from,
      subject,
      snippet: m.data.snippet ?? "",
      receivedAt,
    });
  }
  return out;
}
