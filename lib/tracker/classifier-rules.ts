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

// Application-confirmation detection uses keyword GROUPS rather than rigid
// phrases. Each rule fires when EVERY group has at least one keyword present
// in the body (case-insensitive substring). This catches wording variants we
// can't anticipate ahead of time:
//   "Thanks for your application" — group(thanks) + group(application)
//   "Thank you for applying!"     — group(thank) + group(applying)
//   "Application received"        — group(received) + group(application)
//   "We confirm receipt of your candidacy" — group(confirm) + group(candidacy)
// Substring matching (not word-bounded) so "thank" also matches "thanks" /
// "thanked" naturally. Keep these rules running AFTER rejection patterns so
// "Thanks for applying. Unfortunately..." still classifies as rejected.
type KeywordRule = { groups: string[][]; confidence: number };

const APPLIED_KEYWORD_RULES: KeywordRule[] = [
  { groups: [["thank", "thanks"], ["application", "applied", "applying", "apply"]], confidence: 0.9 },
  { groups: [["received", "receipt"], ["application", "candidacy"]], confidence: 0.88 },
  { groups: [["submitted"], ["application"]], confidence: 0.88 },
  { groups: [["confirm", "confirming", "confirmation"], ["application", "applied"]], confidence: 0.85 },
];

function matchesKeywordGroups(body: string, groups: string[][]): boolean {
  const lower = body.toLowerCase();
  return groups.every((group) => group.some((kw) => lower.includes(kw)));
}

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
      return { status: "rejected", confidence: 0.92, company: detectCompany(email), reason: `pattern: ${pat}` };
    }
  }

  for (const rule of APPLIED_KEYWORD_RULES) {
    if (matchesKeywordGroups(body, rule.groups)) {
      return {
        status: "applied",
        confidence: rule.confidence,
        company: detectCompany(email),
        reason: `applied keywords: ${rule.groups.map((g) => `(${g.join("|")})`).join(" & ")}`,
      };
    }
  }

  if (OA_SENDERS.some((d) => domain.endsWith(d))) {
    return { status: "screen", confidence: 0.9, company: detectCompany(email), reason: `oa sender: ${domain}` };
  }

  for (const pat of INTERVIEW_LINK_PATTERNS) {
    if (pat.test(body)) {
      return { status: "interview", confidence: 0.75, company: detectCompany(email), reason: `scheduler link: ${pat}` };
    }
  }

  return { status: null, confidence: 0, company: null, reason: "no rule matched" };
}

const STOP_WORDS = new Set([
  "unfortunately", "hi", "hello", "thank", "thanks", "dear", "we", "sincerely",
  "best", "regards", "your", "an", "the", "update", "us", "team",
]);

// Ordered body patterns, most specific first. Each captures 1-3 Capitalized
// tokens. Covers the common confirmation phrasings the old single regex missed,
// most importantly "your <Company> application" (no preposition before the
// name) — the exact shape that dropped Tesla into needs-review.
const COMPANY_BODY_PATTERNS = [
  /your\s+([A-Z][A-Za-z0-9&.]+(?:\s+[A-Z][A-Za-z0-9&.]+){0,2})\s+(?:application|team|role|position)/,
  /(?:applying|application|apply|interview|offer|position|role|opportunity|interest)\s+(?:to|for|with|at|from|in)\s+([A-Z][A-Za-z0-9&.]+(?:\s+[A-Z][A-Za-z0-9&.]+){0,2})/,
  /(?:join|joining)\s+([A-Z][A-Za-z0-9&.]+(?:\s+[A-Z][A-Za-z0-9&.]+){0,2})/,
  /(?:from|at|with|to)\s+([A-Z][A-Za-z0-9&]+(?:\s+[A-Z][A-Za-z0-9&]+){0,2})/,
];

function trimStopWords(raw: string): string | null {
  // Cut at the FIRST stop-word, keeping only the tokens before it. This stops
  // a greedy multi-token capture from swallowing a following clause or name:
  // "Citadel Unfortunately" -> "Citadel", "Acme Hi Purabh" -> "Acme".
  const out: string[] = [];
  for (const w of raw.trim().split(/\s+/)) {
    if (STOP_WORDS.has(w.toLowerCase())) break;
    out.push(w);
  }
  return out.length > 0 ? out.join(" ") : null;
}

function extractCompany(body: string): string | null {
  for (const pat of COMPANY_BODY_PATTERNS) {
    const match = body.match(pat);
    if (match) {
      const out = trimStopWords(match[1]!);
      if (out) return out;
    }
  }
  return null;
}

// Provider names that show up as a From display name when the company sends
// through an ATS — never a real employer, so strip them out.
const ATS_DISPLAY_WORDS =
  /\b(greenhouse|lever|workday|ashby|icims|smartrecruiters|jobvite|taleo|successfactors|brassring|myworkday)\b/gi;
// Generic role/function words in sender display names ("Tesla Careers" -> "Tesla").
const GENERIC_SENDER_WORDS =
  /\b(careers?|recruit(?:ing|ment|er)?|talent|acquisition|team|hr|people|no-?reply|do-?not-?reply|notifications?|jobs|hiring|hello|info|mailer|daemon|support)\b/gi;

/**
 * Last-resort company guess from the From header's display name, which for
 * application emails is almost always the employer: "Tesla <noreply@tesla.com>"
 * -> "Tesla", "Stripe Careers <...>" -> "Stripe". Strips ATS provider names and
 * generic role words; returns null if nothing meaningful remains (so an ATS-only
 * sender like "Greenhouse <no-reply@greenhouse.io>" yields null, not a bad name).
 */
export function companyFromSender(from: string): string | null {
  const dn = from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  if (!dn) return null;
  const cleaned = dn
    .replace(/\bvia\b.*/i, "") // "Tesla via Greenhouse" -> "Tesla"
    .replace(ATS_DISPLAY_WORDS, "")
    .replace(GENERIC_SENDER_WORDS, "")
    .replace(/[|·–—,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 && /[A-Za-z]/.test(cleaned) ? cleaned : null;
}

/**
 * Company from the subject, then the snippet, then the sender display name.
 * Subject and snippet are searched SEPARATELY (never concatenated) so a capture
 * can't run off the end of the subject into the snippet's greeting — e.g.
 * subject "Thank you for applying to Figure" + snippet "Hi Purabh, …" must not
 * yield "Figure Purabh". Subject is the curated line, so it wins.
 */
function detectCompany(email: EmailInput): string | null {
  return extractCompany(email.subject)
    ?? extractCompany(email.snippet)
    ?? companyFromSender(email.from);
}
