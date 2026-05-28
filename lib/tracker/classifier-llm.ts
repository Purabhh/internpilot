import type Anthropic from "@anthropic-ai/sdk";
import type { Status } from "@/lib/db/schema";
import type { EmailInput } from "./classifier-rules";

const VALID_STATUS = new Set<Status>(["applied", "screen", "interview", "offer", "rejected"]);

export interface LlmResult {
  company: string | null;
  status: Status | null;
  confidence: number;
  reasoning: string;
}

const SYSTEM_PROMPT = `You classify inbound job-application emails. Return ONLY JSON, no prose, no markdown fence.
Schema: {"company": string|null, "status": "applied"|"screen"|"interview"|"offer"|"rejected"|null, "confidence": number between 0 and 1, "reasoning": string under 80 chars}.
Status meanings:
  applied   — confirmation of submission
  screen    — online assessment, automated screener, take-home invite
  interview — recruiter wants to chat, technical/onsite scheduled
  offer     — offer extended
  rejected  — explicit rejection
If the email isn't related to a job application or you can't tell, set status to null.`;

export async function classifyByLlm(
  client: Anthropic,
  email: EmailInput,
): Promise<LlmResult> {
  const userText = `From: ${email.from}\nSubject: ${email.subject}\nSnippet: ${email.snippet}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userText }],
      });
      const blocks = (resp as { content: Array<{ type: string; text?: string }> }).content;
      const block = blocks.find((c) => c.type === "text");
      const text = block?.text ?? "";
      const parsed = JSON.parse(text);
      const status = VALID_STATUS.has(parsed.status) ? (parsed.status as Status) : null;
      const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
      const company = typeof parsed.company === "string" && parsed.company.trim() ? parsed.company.trim() : null;
      const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
      return { company, status, confidence, reasoning };
    } catch {
      if (attempt === 1) {
        return { company: null, status: null, confidence: 0, reasoning: "malformed llm response" };
      }
    }
  }
  return { company: null, status: null, confidence: 0, reasoning: "unreachable" };
}
