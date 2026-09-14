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

// Hard ceiling on messages fetched per tick. Protects against a pathological
// backlog (e.g. first run against a huge inbox) burning quota in one cycle.
// At 30-50 emails/day this is ~10 days of mail — far more than one tick needs.
const MAX_MESSAGES_PER_TICK = 500;

/**
 * Parse a Gmail "Date" header to unix seconds, falling back to `now` when the
 * header is missing OR unparseable. The naive `Date.parse` returns NaN for a
 * malformed header, and NaN propagates into sorting and the pipeline's
 * status-recency guard — so it must never reach the DB.
 */
export function parseReceivedAt(dateHeader: string | null | undefined, now: number): number {
  if (!dateHeader) return now;
  const ms = new Date(dateHeader).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : now;
}

/**
 * True only for the "supplied startHistoryId is too old" error (HTTP 404/410),
 * which is the one case that legitimately requires a re-baseline. A transient
 * failure (network, 5xx, rate limit) must NOT re-baseline — that would advance
 * the stored historyId and skip everything that arrived during the blip.
 */
export function isStaleHistoryError(err: unknown): boolean {
  const code = (err as { code?: number; status?: number; response?: { status?: number } } | null)?.code
    ?? (err as { status?: number } | null)?.status
    ?? (err as { response?: { status?: number } } | null)?.response?.status;
  return code === 404 || code === 410;
}

export async function fetchNewMessages(
  db: DB,
  client: OAuth2Client,
): Promise<IncomingMessage[]> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const settings = getSettings(db);

  let messageIds: string[] = [];
  // Track whether the incremental history path actually ran. We must NOT key
  // re-baseline off "messageIds is empty" — a quiet inbox legitimately returns
  // zero new ids, and re-baselining on every empty tick re-lists a week of mail
  // every few minutes. Re-baseline only when there's no historyId yet, or the
  // stored one expired.
  let historySucceeded = false;
  if (settings.gmailHistoryId) {
    try {
      // Paginate: history.list returns at most ~100 history records per page.
      // Without following nextPageToken, a long gap (weekend, machine asleep)
      // would silently drop everything past the first page — and since we
      // advance the stored historyId afterward, those messages would never
      // be fetched.
      let pageToken: string | undefined;
      let latestHistoryId: string | undefined;
      do {
        const hist = await gmail.users.history.list({
          userId: "me",
          startHistoryId: settings.gmailHistoryId,
          historyTypes: ["messageAdded"],
          pageToken,
        });
        messageIds.push(
          ...(hist.data.history ?? [])
            .flatMap((h) => (h.messagesAdded ?? []).map((m) => m.message?.id))
            .filter((x): x is string => !!x),
        );
        latestHistoryId = hist.data.historyId ?? latestHistoryId;
        pageToken = hist.data.nextPageToken ?? undefined;
      } while (pageToken && messageIds.length < MAX_MESSAGES_PER_TICK);
      if (latestHistoryId) updateSettings(db, { gmailHistoryId: latestHistoryId });
      historySucceeded = true;
    } catch (err) {
      if (!isStaleHistoryError(err)) {
        // Transient — keep the historyId untouched and retry on the next tick
        // rather than re-baselining and risking skipped messages.
        const m = err instanceof Error ? err.message : String(err);
        console.warn(`[tracker] history.list failed (transient), retrying next tick: ${m}`);
        return [];
      }
      // Stale historyId — fall through to re-baseline.
    }
  }

  if (!historySucceeded) {
    // Re-baseline: no usable history (first run, or it expired). Sweep the
    // recent inbox with pagination. insertEmailIfNew dedupes by gmailMsgId,
    // so re-seeing already-stored messages is harmless.
    let pageToken: string | undefined;
    do {
      const list = await gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
        q: "in:inbox newer_than:7d",
        pageToken,
      });
      messageIds.push(
        ...(list.data.messages ?? []).map((m) => m.id).filter((x): x is string => !!x),
      );
      pageToken = list.data.nextPageToken ?? undefined;
    } while (pageToken && messageIds.length < MAX_MESSAGES_PER_TICK);
    const profile = await gmail.users.getProfile({ userId: "me" });
    if (profile.data.historyId) updateSettings(db, { gmailHistoryId: profile.data.historyId });
  }

  if (messageIds.length > MAX_MESSAGES_PER_TICK) {
    console.warn(`[tracker] capping fetch at ${MAX_MESSAGES_PER_TICK} of ${messageIds.length} ids`);
    messageIds = messageIds.slice(0, MAX_MESSAGES_PER_TICK);
  }

  const now = Math.floor(Date.now() / 1000);
  const out: IncomingMessage[] = [];
  for (const id of messageIds) {
    // Per-message try/catch: a message can be deleted by the user between
    // history.list returning its ID and us calling messages.get, which yields
    // "Requested entity was not found" and would otherwise abort the whole
    // tick. Skip the dead message, log, keep going.
    try {
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
      out.push({
        gmailMsgId: m.data.id ?? id,
        threadId: m.data.threadId ?? null,
        from,
        subject,
        snippet: m.data.snippet ?? "",
        receivedAt: parseReceivedAt(date, now),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[tracker] skip msg ${id}: ${msg}`);
    }
  }
  return out;
}
