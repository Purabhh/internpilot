import type { Status } from "@/lib/db/schema";

export interface EmailInput {
  from: string;
  subject: string;
  snippet: string;
}

export interface RuleResult {
  status: Status | null;
  confidence: number;
  company: string | null;
  reason: string;
}

const REJECTION_PATTERNS = [
  /unfortunately/i,
  /won['']t be moving forward/i,
  /decided not to move forward/i,
  /not the right fit/i,
  /chosen to pursue other candidates/i,
  /no longer under consideration/i,
  /we['']ve decided/i,
  /thank you for your interest.*however/i,
];

const OA_SENDERS = [
  "hackerrank.com",
  "codesignal.com",
  "codility.com",
  "karat.com",
  "coderbyte.com",
  "triplebyte.com",
];

const INTERVIEW_LINK_PATTERNS = [/calendly\.com/i, /cal\.com/i, /chronicle\.app/i, /goodtime\.io/i];

export function classifyByRules(email: EmailInput): RuleResult {
  const body = `${email.subject} ${email.snippet}`;
  const fromLower = email.from.toLowerCase();
  const domain = fromLower.split("@")[1]?.replace(/>$/, "") ?? "";

  for (const pat of REJECTION_PATTERNS) {
    if (pat.test(body)) {
      return { status: "rejected", confidence: 0.92, company: extractCompany(body), reason: `pattern: ${pat}` };
    }
  }

  if (OA_SENDERS.some((d) => domain.endsWith(d))) {
    return { status: "screen", confidence: 0.9, company: extractCompany(body), reason: `oa sender: ${domain}` };
  }

  for (const pat of INTERVIEW_LINK_PATTERNS) {
    if (pat.test(body)) {
      return { status: "interview", confidence: 0.75, company: extractCompany(body), reason: `scheduler link: ${pat}` };
    }
  }

  return { status: null, confidence: 0, company: null, reason: "no rule matched" };
}

const STOP_WORDS = new Set([
  "unfortunately", "hi", "hello", "thank", "thanks", "dear", "we", "sincerely",
  "best", "regards", "your", "an", "the", "update",
]);

function extractCompany(body: string): string | null {
  // Capture 1-3 capitalized tokens after preposition, then trim trailing
  // sentence-starting words ("Citadel Unfortunately" -> "Citadel").
  const match = body.match(/(?:from|at|with|to)\s+([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+){0,2})/);
  if (!match) return null;
  const words = match[1].trim().split(/\s+/);
  while (words.length > 0 && STOP_WORDS.has(words[words.length - 1]!.toLowerCase())) {
    words.pop();
  }
  return words.length > 0 ? words.join(" ") : null;
}
