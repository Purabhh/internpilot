/**
 * Purabh's job-search niche: fintech / banks / payments / crypto / trading /
 * market infrastructure, entry-level SWE. Also decides which of his two
 * resumes fits a posting.
 *
 * Pure TS with no Node imports so the jobs page (client) and the SQL filter
 * (server) share one source of truth. Edit the lists here to retune.
 */

/** Company-name keywords that put a posting in the niche. Lowercase. */
export const NICHE_COMPANIES = {
  bank: [
    "jpmorgan", "jp morgan", "chase", "goldman sachs", "morgan stanley", "citi", "citigroup", "citibank",
    "wells fargo", "bank of america", "bofa", "barclays", "deutsche bank", "ubs", "hsbc", "bny",
    "state street", "northern trust", "capital one", "american express", "us bank", "u.s. bank",
    "pnc", "truist", "td bank", "td securities", "rbc", "bmo", "santander", "citizens", "m&t bank",
    "fifth third", "keybank", "regions", "regions bank", "citizens bank", "huntington bank", "huntington national bank", "ally",
    "synchrony", "discover", "mizuho",
    "nomura", "mufg", "bnp paribas", "societe generale", "credit agricole", "jefferies", "evercore",
    "lazard", "raymond james", "charles schwab", "schwab", "fidelity", "fidelity investments", "vanguard", "blackrock",
    "t. rowe price", "invesco", "franklin templeton", "pimco", "wellington", "blackstone", "kkr",
    "apollo", "apollo global", "carlyle", "bridgewater", "aqr", "point72", "millennium", "balyasny", "man group",
    "moody's", "s&p global", "msci", "broadridge", "dtcc", "fannie mae", "freddie mac", "federal reserve",
  ],
  payments: [
    "visa", "mastercard", "paypal", "stripe", "plaid", "ramp", "brex", "mercury", "adyen", "fiserv",
    "fis", "global payments", "jack henry", "toast", "block", "square", "cash app", "affirm", "klarna",
    "marqeta", "chime", "sofi", "robinhood", "wise", "remitly", "western union", "intuit", "bill.com",
    "navan", "carta", "addepar", "betterment", "wealthfront", "acorns", "dave", "upstart", "lendingclub",
    "pave finance", "modern treasury", "unit21", "alloy", "socure", "checkout.com", "rapyd", "nium",
  ],
  crypto: [
    "coinbase", "kraken", "gemini", "circle", "paxos", "anchorage", "fireblocks", "chainalysis",
    "ripple", "consensys", "alchemy", "uniswap", "polygon", "solana", "ava labs", "okx", "binance",
    "blockchain.com", "bitgo", "galaxy digital", "crypto.com", "ellipsis labs", "jito", "aptos", "sui",
  ],
  markets: [
    "bloomberg", "nasdaq", "intercontinental exchange", "nyse", "cme group", "cboe", "tradeweb",
    "marketaxess", "lseg", "london stock exchange", "factset", "refinitiv", "ice data",
  ],
  trading: [
    "citadel", "jane street", "hudson river trading", "two sigma", "d. e. shaw", "de shaw", "jump trading",
    "drw", "imc", "optiver", "susquehanna", "sig", "akuna", "virtu", "tower research", "five rings",
    "old mission", "imc trading", "chicago trading company", "wolverine", "flow traders", "xtx", "headlands",
    "radix", "peak6", "belvedere", "maven", "geneva trading", "dv trading", "edgehog", "3red",
    "arrowstreet", "voleon", "pdt partners", "marshall wace", "squarepoint", "qube", "gts",
  ],
} as const;

export type NicheCategory = keyof typeof NICHE_COMPANIES;

/**
 * Names that are also ordinary words or other companies' names ("Mercury
 * Systems", "Circle Logistics", "H&R Block"). These only count when they ARE
 * the whole company name, ignoring suffixes like "Inc" or "Financial".
 */
export const EXACT_ONLY_COMPANIES = new Set([
  "mercury", "circle", "block", "square", "toast", "ally", "discover", "regions", "citizens",
  "dave", "alloy", "sui", "apollo", "wellington", "fidelity", "chase", "wise", "ramp", "imc",
  "sig", "drw", "gts", "qube", "maven", "radix", "jito", "aptos", "polygon", "solana", "fis",
  "unit21", "nium", "navan", "acorns", "carta", "plaid", "brex", "visa", "dtcc",
]);

const COMPANY_SUFFIX_RE =
  /\b(inc|llc|l\.l\.c|ltd|corp|corporation|co|company|group|holdings|financial|technologies|technology|labs|the)\b\.?/g;

function normalizeCompany(company: string): string {
  return company.toLowerCase().replace(COMPANY_SUFFIX_RE, " ").replace(/[^a-z0-9&.]+/g, " ").trim();
}

/** Role keywords that signal a finance/fintech posting even at an unlisted company. */
export const NICHE_ROLE_KEYWORDS = [
  "payment", "fintech", "trading", "trade ", "ledger", "settlement", "clearing", "blockchain",
  "crypto", "web3", "smart contract", "quant", "brokerage", "banking", "wealth", "asset management",
  "risk", "fraud", "credit", "lending", "card", "treasury", "exchange", "market data", "order management",
] as const;

/** Roles that are never a fit, niche company or not (seniority, hardware, non-eng). */
export const EXCLUDED_ROLE_KEYWORDS = [
  "senior", "sr.", "sr ", "staff", "principal", "lead ", "manager", "director", "head of", "vp ",
  "iii", " iv", "phd", "asic", "fpga", "rtl", "verification engineer", "physical design", "analog",
  "circuit", "silicon", "hardware", "mechanical", "electrical engineer", "technician", "recruiter", "recruiting",
  "sales", "account executive", "marketing", "graduate trader", "junior trader", "trader ",
  "firmware", "co-op", "coop", "quality assurance", "qa analyst", "product analyst", "business",
  "seasonal", "insurance",
] as const;

export type ResumePick = "ai" | "backend";

export const RESUME_LABEL: Record<ResumePick, string> = {
  ai: "AI",
  backend: "Backend",
};

/** Which file each pick means, for tooltips. */
export const RESUME_FILE: Record<ResumePick, string> = {
  ai: "Resume_PurabhSingh_AI.pdf (vaultdb + Mochee)",
  backend: "Resume_PurabhSingh_backend.pdf (FastRust + Mochee)",
};

/** Role keywords that call for the AI resume (vaultdb / Mochee). */
const AI_ROLE_KEYWORDS = [
  "ai", "a.i.", "ml", "machine learning", "llm", "genai", "gen ai", "generative", "deep learning",
  "nlp", "data scien", "data engineer", "data analyst", "analytics", "research", "applied scien",
  "forward deployed", "forward-deployed", "solutions engineer", "agent", "rag", "computer vision",
  "quantitative analyst", "quant analyst", "quantitative research", "intelligence",
];

/** Role keywords that call for the backend resume (FastRust). */
const BACKEND_ROLE_KEYWORDS = [
  "backend", "back-end", "back end", "infrastructure", "infra", "platform", "systems", "distributed",
  "low latency", "low-latency", "c++", "rust", "golang", " go ", "java", "api", "core engineering",
  "site reliability", "sre", "devops", "cloud", "storage", "networking", "performance",
  "quantitative developer", "quant developer", "trading systems", "exchange", "matching",
];

export interface NicheMatch {
  /** True when the posting is in the fintech/finance niche and not excluded. */
  inNiche: boolean;
  category: NicheCategory | "role" | null;
  resume: ResumePick;
  /** One short line explaining the resume pick, for a tooltip. */
  resumeReason: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary matcher so "ice" doesn't hit "Office" or "sig" hit "Design".
 * "stem" mode only anchors the start of longer keywords, so "payment" matches
 * "Payments" and "data scien" matches "Data Science"; keywords of 3 chars or
 * fewer ("ai", "ml", "api") stay whole-word in both modes.
 */
function wordRe(words: readonly string[], mode: "whole" | "stem" = "whole"): RegExp {
  const pre = "(?:^|[^a-z0-9])";
  const post = "(?=$|[^a-z0-9])";
  const parts = words.map((w) => {
    const k = w.trim();
    const e = escapeRegex(k);
    return mode === "stem" && k.length > 3 ? `${pre}${e}` : `${pre}${e}${post}`;
  });
  return new RegExp(parts.join("|"), "i");
}

const COMPANY_RES = Object.fromEntries(
  Object.entries(NICHE_COMPANIES).map(([k, v]) => [k, wordRe(v.filter((n) => !EXACT_ONLY_COMPANIES.has(n)))]),
) as Record<NicheCategory, RegExp>;
const EXACT_CATEGORY = new Map<string, NicheCategory>();
for (const [cat, names] of Object.entries(NICHE_COMPANIES) as [NicheCategory, readonly string[]][]) {
  for (const n of names) if (EXACT_ONLY_COMPANIES.has(n)) EXACT_CATEGORY.set(n, cat);
}
const NICHE_ROLE_RE = wordRe(NICHE_ROLE_KEYWORDS, "stem");
const EXCLUDED_RE = wordRe(EXCLUDED_ROLE_KEYWORDS);
const AI_RE = wordRe(AI_ROLE_KEYWORDS, "stem");
const BACKEND_RE = wordRe(BACKEND_ROLE_KEYWORDS, "stem");

export function companyCategory(company: string): NicheCategory | null {
  const exact = EXACT_CATEGORY.get(normalizeCompany(company));
  if (exact) return exact;
  for (const cat of Object.keys(COMPANY_RES) as NicheCategory[]) {
    if (COMPANY_RES[cat].test(company)) return cat;
  }
  return null;
}

export function isExcludedRole(role: string): boolean {
  return EXCLUDED_RE.test(role);
}

export function pickResume(company: string, role: string): { resume: ResumePick; reason: string } {
  // The role wording is the strongest signal, so check it before the company.
  if (AI_RE.test(role)) return { resume: "ai", reason: "AI / data / ML role" };
  if (BACKEND_RE.test(role)) return { resume: "backend", reason: "backend / infra / systems role" };
  const cat = companyCategory(company);
  // Banks and asset managers read Anomalyy (market data + FOMC/news analysis)
  // as the most relevant project; trading, exchanges, crypto and payments
  // engineering care more about systems depth.
  if (cat === "bank") return { resume: "ai", reason: "bank: Anomalyy is the closest finance project" };
  if (cat) return { resume: "backend", reason: `${cat}: systems depth matters most` };
  return { resume: "backend", reason: "general SWE: backend is the default" };
}

export function matchNiche(company: string, role: string): NicheMatch {
  const { resume, reason } = pickResume(company, role);
  if (isExcludedRole(role)) {
    return { inNiche: false, category: null, resume, resumeReason: reason };
  }
  const cat = companyCategory(company);
  if (cat) return { inNiche: true, category: cat, resume, resumeReason: reason };
  if (NICHE_ROLE_RE.test(role)) return { inNiche: true, category: "role", resume, resumeReason: reason };
  return { inNiche: false, category: null, resume, resumeReason: reason };
}

/** All company keywords, flattened — used to build the SQL prefilter. */
export const ALL_NICHE_COMPANY_KEYWORDS: string[] = Object.values(NICHE_COMPANIES).flat();
