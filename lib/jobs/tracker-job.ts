import Anthropic from "@anthropic-ai/sdk";
import type { DB } from "@/lib/db/client";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";
import { loadOAuthClient, fetchNewMessages } from "@/lib/tracker/gmail-client";
import { processEmails } from "@/lib/tracker/pipeline";

/**
 * Runs one tracker cycle: fetch new Gmail messages and classify them.
 *
 * Anthropic is OPTIONAL. The rule classifier handles rejection / applied /
 * OA / interview patterns without an LLM — which covers the bulk of real
 * email — so a missing ANTHROPIC_API_KEY shouldn't disable the tracker
 * entirely. It just disables the LLM fallback for ambiguous messages,
 * which then land in `needs_review` instead.
 */
export async function tickTracker(db: DB): Promise<void> {
  const settings = getSettings(db);
  if (!settings.trackerEnabled) return;
  if (!settings.gmailConnectedAt) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  if (!anthropic) {
    console.warn("[tracker] ANTHROPIC_API_KEY missing — running rule-only mode");
  }

  // Stamp the tick result so the Overview can show a real "LAST: 2m ago · +3"
  // signal. Success path sets trackerLastRunAt + trackerLastInserted and clears
  // any prior error; error path also stamps trackerLastRunAt + records the
  // message so a long string of failures becomes visible instead of silent.
  const now = Math.floor(Date.now() / 1000);
  try {
    const gmail = loadOAuthClient();
    const messages = await fetchNewMessages(db, gmail);
    const inserted = messages.length > 0 ? await processEmails(db, anthropic, messages) : 0;
    updateSettings(db, {
      trackerLastRunAt: now,
      trackerLastInserted: inserted,
      trackerLastError: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tracker] tick failed:", msg);
    updateSettings(db, {
      trackerLastRunAt: now,
      trackerLastError: msg.slice(0, 200),
    });
  }
}
