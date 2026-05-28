import type Anthropic from "@anthropic-ai/sdk";
import type { DB } from "@/lib/db/client";
import type { Status } from "@/lib/db/schema";
import { classifyByRules, type EmailInput } from "./classifier-rules";
import { classifyByLlm } from "./classifier-llm";
import { matchEmailToApplication } from "./matcher";
import { insertEmailIfNew } from "@/lib/db/queries/emails";
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
  anthropic: Anthropic,
  messages: IncomingMessage[],
): Promise<void> {
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
    } else {
      const llmResult = await classifyByLlm(anthropic, input);
      if (llmResult.status) {
        status = llmResult.status;
        confidence = llmResult.confidence;
        company = llmResult.company;
        classifier = "llm";
      }
    }

    const matched = matchEmailToApplication(db, company, msg.from.split("@")[1] ?? null);
    const confident = status !== null && confidence >= CONFIDENCE_THRESHOLD;
    const willUpdate = Boolean(confident && matched);

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
      applicationId: willUpdate ? matched!.id : null,
      classifier,
      needsReview: willUpdate ? 0 : 1,
    });

    if (!inserted) continue;

    if (willUpdate && status && matched) {
      updateApplication(db, matched.id, { status, lastEmailAt: msg.receivedAt });
    }
  }
}
