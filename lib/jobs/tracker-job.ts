import Anthropic from "@anthropic-ai/sdk";
import type { DB } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries/settings";
import { loadOAuthClient, fetchNewMessages } from "@/lib/tracker/gmail-client";
import { processEmails } from "@/lib/tracker/pipeline";

export async function tickTracker(db: DB): Promise<void> {
  const settings = getSettings(db);
  if (!settings.trackerEnabled) return;
  if (!settings.gmailConnectedAt) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[tracker] ANTHROPIC_API_KEY missing — skipping cycle");
    return;
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const gmail = loadOAuthClient();
    const messages = await fetchNewMessages(db, gmail);
    if (messages.length > 0) {
      await processEmails(db, anthropic, messages);
    }
  } catch (err) {
    console.error("[tracker] tick failed:", err);
  }
}
