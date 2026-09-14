import type Anthropic from "@anthropic-ai/sdk";
import type { DB } from "@/lib/db/client";
import type { Status } from "@/lib/db/schema";
import { classifyByRules, type EmailInput } from "./classifier-rules";
import { classifyByLlm } from "./classifier-llm";
import { parseSenderDomain } from "./matcher";
import { resolveApplicationForEmail } from "./resolve-application";
import { insertEmailIfNew, correctEmail } from "@/lib/db/queries/emails";
import { updateApplication } from "@/lib/db/queries/applications";

const CONFIDENCE_THRESHOLD = 0.7;

export interface IncomingMessage {
  gmailMsgId: string;
  threadId: string | null;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: number;
}

export async function processEmails(
  db: DB,
  anthropic: Anthropic | null,
  messages: IncomingMessage[],
): Promise<number> {
  // Returns the count of NEW emails inserted this batch (Gmail messages we
  // hadn't seen before). Duplicates skipped via the gmail_msg_id unique
  // constraint don't count. The Overview surfaces this as the tracker's
  // "+N" delta — same pattern as sources.lastInserted.
  let insertedCount = 0;
  for (const msg of messages) {
    const input: EmailInput = { from: msg.from, subject: msg.subject, snippet: msg.snippet };

    let status: Status | null = null;
    let confidence = 0;
    let company: string | null = null;
    let classifier: "rules" | "llm" | "needs_review" = "needs_review";

    const ruleResult = classifyByRules(input);
    if (ruleResult.status) {
      status = ruleResult.status;
      confidence = ruleResult.confidence;
      company = ruleResult.company;
      classifier = "rules";
    } else if (anthropic) {
      // No rule fired — fall through to the LLM if we have a key, otherwise
      // leave classifier="needs_review" so the email is parked for triage.
      const llmResult = await classifyByLlm(anthropic, input);
      if (llmResult.status) {
        status = llmResult.status;
        confidence = llmResult.confidence;
        company = llmResult.company;
        classifier = "llm";
      }
    }

    // Insert FIRST as the idempotency gate. Application matching/creation has
    // side effects (it can create rows), so it must only run for genuinely-new
    // emails — otherwise a replayed message (the re-baseline path re-sees the
    // same ids) would spawn duplicate applications before insert returns null.
    // Optimistically store as needs-review with no link; we clear that below
    // if we successfully attach an application.
    const inserted = insertEmailIfNew(db, {
      gmailMsgId: msg.gmailMsgId,
      threadId: msg.threadId,
      fromAddr: msg.from,
      subject: msg.subject,
      snippet: msg.snippet,
      receivedAt: msg.receivedAt,
      classifiedCompany: company,
      classifiedStatus: status,
      confidence,
      applicationId: null,
      classifier,
      needsReview: 1,
    });
    if (!inserted) continue; // already seen — first sighting handled it
    insertedCount += 1;

    // Act only on a confident classification. Resolve the application this
    // email belongs to: match an existing one, or — only for "applied"
    // confirmations — create one. Non-applied emails to unknown companies
    // (e.g. a rejection from a company you never tracked) stay needs-review.
    const confident = status !== null && confidence >= CONFIDENCE_THRESHOLD;
    if (!confident) continue;

    const app = resolveApplicationForEmail(db, {
      company,
      senderDomain: parseSenderDomain(msg.from),
      emailText: `${msg.subject} ${msg.snippet}`,
      createIfMissing: status === "applied",
    });
    if (!app) continue; // no match and not creatable — leave it needs-review

    // Link the email to the application and clear needs-review.
    correctEmail(db, inserted.id, { applicationId: app.id });

    // Advance status only if this email is at least as recent as the newest one
    // already recorded for the app. Without this guard an older email processed
    // out of order (the re-baseline path returns newest-first) could regress a
    // status — e.g. an old "applied" clobbering a newer "interview".
    if (status && (app.lastEmailAt == null || msg.receivedAt >= app.lastEmailAt)) {
      updateApplication(db, app.id, { status, lastEmailAt: msg.receivedAt });
    }
  }
  return insertedCount;
}
