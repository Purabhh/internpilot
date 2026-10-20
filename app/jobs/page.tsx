"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, ArrowUpRight, Search, Plus, Bookmark, RefreshCw } from "lucide-react";
import { fetchJson, patchJson, postJson } from "@/lib/ui/fetcher";
import type { Job, Source } from "@/lib/ui/types";
import { Card, MonoBadge, DashedDivider, Switch, WavyUnderline } from "../_components/ui";
import { atsFromUrl, relativeTime, parseTerms, termBucket, isFresh, formatSalaryRange } from "@/lib/ui/ats";
import { matchNiche, RESUME_LABEL, RESUME_FILE } from "@/lib/niche/profile";
import { jobType, JOB_TYPE_LABEL, type JobType } from "@/lib/jobs/job-type";

const SOURCE_DISPLAY: Record<string, { name: string; sub: string }> = {
  simplify_summer26_offseason: { name: "Simplify", sub: "Off-Season Internships" },
  simplify_newgrad: { name: "Simplify", sub: "New Grad" },
  vansh_summer27_offseason: { name: "Vansh", sub: "Off-Season Internships" },
  speedyapply_swe26: { name: "SpeedyApply", sub: "SWE (parser deferred)" },
  jobright_swe_internship: { name: "Jobright", sub: "SWE Internships" },
  jobright_swe_newgrad: { name: "Jobright", sub: "SWE New Grad" },
};

function atsVariant(code: string): "pink" | "blue" | "black" | "default" {
  if (code === "GH") return "pink";
  if (code === "LV" || code === "AS") return "blue";
  if (code === "WD") return "black";
  return "default";
}

const AGE_CHIPS: Array<{ label: string; days: number | null }> = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "6mo", days: 180 },
  { label: "1y", days: 365 },
  { label: "all", days: null },
];

type TypeFilter = "all" | JobType;
const TYPE_CHIPS: Array<{ label: string; key: TypeFilter }> = [
  { label: "all", key: "all" },
  { label: "internship", key: "internship" },
  { label: "new grad", key: "newgrad" },
];

// Minimum ANNUAL salary chips. Selecting any value > 0 hides N/A rows (jobs we
// couldn't find pay for), per the "hide N/A when filtering by pay" rule.
const SALARY_CHIPS: Array<{ label: string; value: number | null }> = [
  { label: "any", value: null },
  { label: "$80k+", value: 80_000 },
  { label: "$100k+", value: 100_000 },
  { label: "$120k+", value: 120_000 },
  { label: "$150k+", value: 150_000 },
];

// One-click market chips matched as a location substring (server-side `loc`).
const MARKET_CHIPS: Array<{ label: string; value: string }> = [
  { label: "NYC", value: "new york" },
  { label: "SF", value: "san francisco" },
  { label: "Seattle", value: "seattle" },
  { label: "Austin", value: "austin" },
  { label: "Boston", value: "boston" },
];

// US state codes for the location dropdown (matched as ", XX" in the location).
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
] as const;

function termColor(bucket: ReturnType<typeof termBucket>): "pink" | "blue" | "black" | "default" {
  if (bucket === "fall" || bucket === "winter" || bucket === "spring") return "pink";
  if (bucket === "newgrad") return "blue";
  if (bucket === "summer") return "black";
  return "default";
}

export default function JobsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(30); // default 30d — anything older is rarely worth applying to
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [minSalary, setMinSalary] = useState<number | null>(null);
  const [market, setMarket] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<string>("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  // On by default: fintech / banks / payments / crypto / trading only (lib/niche/profile.ts).
  const [nicheOnly, setNicheOnly] = useState(true);
  const PER_PAGE = 30;

  // Debounce the search box so we don't fire a server query per keystroke.
  // Search is server-side (it filters the whole DB, not just the visible
  // page), so each change is a real request.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Build the shared filter querystring used by both the page query and the
  // count query so the "N matching" badge stays in lockstep with what the
  // server is actually filtering.
  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (maxAgeDays != null) p.set("maxAgeDays", String(maxAgeDays));
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (minSalary) p.set("minSalary", String(minSalary));
    if (market) p.set("loc", market);
    if (stateCode) p.set("state", stateCode);
    if (remoteOnly) p.set("remote", "1");
    if (nicheOnly) p.set("niche", "1");
    return p;
  }, [maxAgeDays, typeFilter, debouncedSearch, minSalary, market, stateCode, remoteOnly, nicheOnly]);
  const filterKey = filterParams.toString();

  const jobsQ = useQuery({
    queryKey: ["jobs", page, filterKey],
    queryFn: () => {
      const params = new URLSearchParams(filterParams);
      params.set("limit", String(PER_PAGE));
      params.set("offset", String(page * PER_PAGE));
      return fetchJson<Job[]>(`/api/jobs?${params.toString()}`);
    },
  });
  const countQ = useQuery({
    queryKey: ["jobs-count", filterKey],
    queryFn: () => fetchJson<{ total: number }>(`/api/jobs/count?${filterKey}`),
  });
  const sourcesQ = useQuery({
    queryKey: ["sources"],
    queryFn: () => fetchJson<Source[]>("/api/sources"),
  });

  const action = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "applied" | "save" | "dismiss" }) =>
      patchJson<unknown>(`/api/jobs/${id}`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      // "applied" and "save" both create a tracker card, so refresh that too.
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
  });

  const toggleSource = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      patchJson<unknown>("/api/sources", { name, enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });

  // Manual "check all sources now" — the refresh button. Hits an endpoint that
  // bypasses the scraper daemon's toggle/interval (a click is an explicit ask)
  // and coalesces concurrent calls server-side, so mashing it is harmless.
  // The "+N new" result lingers a few seconds, then the label resets.
  const [refreshResult, setRefreshResult] = useState<number | null>(null);
  const refresh = useMutation({
    mutationFn: () => postJson<{ inserted: number; ran: number; failed: number }>("/api/sources/refresh", {}),
    onSuccess: (r) => {
      setRefreshResult(r.inserted);
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["jobs-count"] });
      qc.invalidateQueries({ queryKey: ["sources"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
  useEffect(() => {
    if (refreshResult == null) return;
    const t = setTimeout(() => setRefreshResult(null), 6000);
    return () => clearTimeout(t);
  }, [refreshResult]);

  // All filters (term, age, search) are server-side now — what the API
  // returns is exactly what we render, and the count matches the whole DB.
  const filtered = jobsQ.data ?? [];
  const totalMatching = countQ.data?.total ?? null;

  return (
    <div className="mt-4 grid grid-cols-12 gap-6">
      {/* Main */}
      <div className="col-span-12 lg:col-span-9 space-y-5">
        {/* Heading */}
        <div className="relative">
          <h1 className="headline text-6xl">
            the <em className="not-italic text-[var(--color-pink)] relative inline-block">job board<WavyUnderline /></em>.
          </h1>
          <p className="text-[var(--color-ink-mute)] mt-3 text-sm">
            {totalMatching ?? "…"} matching · {filtered.length} on this page · click → to open
          </p>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="card-hard flex items-center gap-2 px-3 py-2 flex-1 min-w-[280px] max-w-md !p-2 !pl-3">
            <Search className="w-4 h-4 opacity-60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search company, role, location…"
              autoComplete="off"
              suppressHydrationWarning
              className="bg-transparent outline-none flex-1 text-sm mono"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mr-1">posted</span>
            {AGE_CHIPS.map((chip) => {
              const active = maxAgeDays === chip.days;
              return (
                <button
                  key={chip.label}
                  onClick={() => { setMaxAgeDays(chip.days); setPage(0); }}
                  className={`mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] transition-colors ${
                    active
                      ? "bg-[var(--color-pink)] text-white shadow-[2px_2px_0_#0a0a0a]"
                      : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          <MonoBadge>
            {totalMatching == null ? "…" : `${totalMatching} matching`}
          </MonoBadge>
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            title="Check all enabled sources for new jobs right now"
            className={`mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] flex items-center gap-1.5 transition-colors ${
              refresh.isPending
                ? "bg-[var(--color-cream-200)] cursor-wait"
                : refreshResult != null
                  ? "bg-[var(--color-pink)] text-white shadow-[2px_2px_0_#0a0a0a]"
                  : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${refresh.isPending ? "animate-spin" : ""}`} />
            {refresh.isPending
              ? "checking…"
              : refreshResult != null
                ? `+${refreshResult} new`
                : refresh.isError
                  ? "failed · retry"
                  : "refresh"}
          </button>
        </div>

        {/* Niche filter row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mr-1">focus</span>
          <button
            onClick={() => { setNicheOnly((v) => !v); setPage(0); }}
            title="Banks, payments, fintech, crypto, trading firms and exchanges. Senior and hardware roles hidden."
            className={`mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] transition-colors ${
              nicheOnly
                ? "bg-[var(--color-pink)] text-white shadow-[2px_2px_0_#0a0a0a]"
                : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
            }`}
          >
            my niche
          </button>
          <span className="mono text-[10px] text-[var(--color-ink-mute)] ml-1">
            {nicheOnly ? "fintech · banks · payments · crypto · trading" : "showing every job"}
          </span>
        </div>

        {/* Type filter row: internship vs new grad (lib/jobs/job-type.ts) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mr-1">type</span>
          {TYPE_CHIPS.map((chip) => {
            const active = typeFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => { setTypeFilter(chip.key); setPage(0); }}
                className={`mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] transition-colors ${
                  active
                    ? "bg-[var(--color-blue)] text-white shadow-[2px_2px_0_#0a0a0a]"
                    : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Pay filter row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mr-1">min pay</span>
          {SALARY_CHIPS.map((chip) => {
            const active = minSalary === chip.value;
            return (
              <button
                key={chip.label}
                onClick={() => { setMinSalary(chip.value); setPage(0); }}
                className={`mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] transition-colors ${
                  active
                    ? "bg-[var(--color-pink)] text-white shadow-[2px_2px_0_#0a0a0a]"
                    : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          {minSalary != null && (
            <span className="mono text-[10px] text-[var(--color-ink-mute)] ml-1">
              n/a hidden while filtering pay
            </span>
          )}
        </div>

        {/* Location filter row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mr-1">where</span>
          {MARKET_CHIPS.map((chip) => {
            const active = market === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => { setMarket(active ? null : chip.value); setPage(0); }}
                className={`mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] transition-colors ${
                  active
                    ? "bg-[var(--color-blue)] text-white shadow-[2px_2px_0_#0a0a0a]"
                    : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <button
            onClick={() => { setRemoteOnly((v) => !v); setPage(0); }}
            className={`mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] transition-colors ${
              remoteOnly
                ? "bg-[var(--color-blue)] text-white shadow-[2px_2px_0_#0a0a0a]"
                : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
            }`}
          >
            remote
          </button>
          <select
            value={stateCode}
            onChange={(e) => { setStateCode(e.target.value); setPage(0); }}
            suppressHydrationWarning
            className="mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] outline-none cursor-pointer"
          >
            <option value="">state</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(market || stateCode || remoteOnly) && (
            <button
              onClick={() => { setMarket(null); setStateCode(""); setRemoteOnly(false); setPage(0); }}
              className="mono text-[11px] uppercase tracking-wider px-2 py-1 border-2 border-dashed border-[var(--color-ink)]/50 hover:bg-[var(--color-cream-200)]"
            >
              clear
            </button>
          )}
        </div>

        {/* Table */}
        <Card className="!p-0 overflow-hidden">
          <div className="grid grid-cols-[2.3fr_1.1fr_96px_54px_74px_150px] mono text-[10px] uppercase tracking-wider text-[var(--color-ink-mute)] px-5 py-3 border-b-2 border-[var(--color-ink)]">
            <div>Company / Role</div>
            <div>Location</div>
            <div>Salary</div>
            <div title="Applicant Tracking System">ATS</div>
            <div>Posted</div>
            <div className="text-right">Actions</div>
          </div>
          {jobsQ.isLoading && (
            <div className="px-5 py-10 mono text-sm text-[var(--color-ink-mute)] text-center">loading…</div>
          )}
          {!jobsQ.isLoading && filtered.length === 0 && (
            <div className="px-5 py-10 mono text-sm text-[var(--color-ink-mute)] text-center">
              no jobs yet — enable scrapers to start filling this list
            </div>
          )}
          {filtered.map((j) => {
            const ats = atsFromUrl(j.url);
            // "New Grad" feed tags are replaced by the computed type badge;
            // season tags (e.g. "Spring 2027") still show.
            const terms = parseTerms(j.terms).filter((t) => termBucket(t) !== "newgrad");
            const type = jobType(j);
            const niche = matchNiche(j.company, j.role);
            // "Fresh" means the posting is recent at the company — that's what
            // matters for an actual job hunt (apply early, beat the queue). We key
            // off postedAt (when the aggregator says it was posted), falling back
            // to scrapedAt only when postedAt is missing. Both the overview's
            // recent-jobs panel and this column use the same clock.
            const fresh = isFresh(j.postedAt ?? j.scrapedAt, 6);
            // NYC is the user's target market — tint these rows gold so they're
            // easy to spot when scanning the list. Fresh (pink) wins if both apply
            // because timing matters more than location once a row is fresh.
            const loc = (j.location ?? "").toLowerCase();
            const isTargetCity = loc.includes("nyc") || loc.includes("new york");
            const rowStyle = fresh
              ? { backgroundColor: "rgba(255, 31, 110, 0.08)" }
              : isTargetCity
                ? { backgroundColor: "rgba(212, 153, 27, 0.12)" }
                : undefined;
            return (
              <div
                key={j.id}
                className="grid grid-cols-[2.3fr_1.1fr_96px_54px_74px_150px] items-center px-5 py-3 border-b border-dashed border-[var(--color-ink)]/30 hover:bg-[var(--color-cream-200)]"
                style={rowStyle}
              >
                <div className="min-w-0">
                  <div className="font-bold truncate flex items-center gap-2">
                    {j.company}
                    {fresh && (
                      <span className="mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[var(--color-pink)] text-white border-2 border-[var(--color-ink)] shadow-[1.5px_1.5px_0_#0a0a0a]">
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="mono text-xs text-[var(--color-ink-mute)] uppercase truncate">{j.role}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <MonoBadge variant={type === "internship" ? "default" : "blue"} className="!text-[9px] !py-0">
                      {JOB_TYPE_LABEL[type]}
                    </MonoBadge>
                    <MonoBadge
                      variant={niche.resume === "ai" ? "pink" : "black"}
                      className="!text-[9px] !py-0"
                      title={`Apply with ${RESUME_FILE[niche.resume]} — ${niche.resumeReason}`}
                    >
                      {RESUME_LABEL[niche.resume]} resume
                    </MonoBadge>
                    {niche.inNiche && niche.category && (
                      <MonoBadge variant="blue" className="!text-[9px] !py-0">
                        {niche.category === "role" ? "fintech role" : niche.category}
                      </MonoBadge>
                    )}
                  </div>
                  {terms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {terms.map((t, i) => (
                        <MonoBadge key={i} variant={termColor(termBucket(t))} className="!text-[9px] !py-0">
                          {t}
                        </MonoBadge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mono text-xs text-[var(--color-ink-mute)] truncate">{j.location ?? "—"}</div>
                <div className="mono text-xs" title={j.salaryRaw ?? undefined}>
                  {(() => {
                    const label = formatSalaryRange(j.salaryMin, j.salaryMax);
                    if (label) return <span className="font-bold text-[var(--color-ink)]">{label}</span>;
                    // Not yet checked vs checked-and-none-found: a dim dot means
                    // "the enricher hasn't gotten to this row"; "N/A" means it
                    // looked and the posting listed no pay.
                    if (j.salaryEnrichedAt == null) return <span className="text-[var(--color-ink-mute)]/50">·</span>;
                    return <span className="text-[var(--color-ink-mute)]">N/A</span>;
                  })()}
                </div>
                <div>
                  <MonoBadge variant={atsVariant(ats.code)}>{ats.code}</MonoBadge>
                </div>
                <div
                  className="mono text-xs text-[var(--color-ink-mute)]"
                  title={[
                    j.postedAt ? `Posted: ${new Date(j.postedAt * 1000).toLocaleString()}` : "Posted: unknown",
                    `Discovered: ${new Date(j.scrapedAt * 1000).toLocaleString()}`,
                  ].join("\n")}
                >
                  {relativeTime(j.postedAt ?? j.scrapedAt)}
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => action.mutate({ id: j.id, action: "save" })}
                    className="card-hard !p-1.5 hover:bg-[var(--color-blue)] hover:text-white"
                    title="Save to apply later"
                  >
                    <Bookmark className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => action.mutate({ id: j.id, action: "applied" })}
                    className="card-hard !p-1.5 hover:bg-[var(--color-pink)] hover:text-white"
                    title="Mark as applied"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => action.mutate({ id: j.id, action: "dismiss" })}
                    className="card-hard !p-1.5 hover:bg-[var(--color-ink)] hover:text-white"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-hard !p-1.5 hover:bg-[var(--color-blue)] hover:text-white"
                    title="Open posting"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between mono text-sm">
          <div className="text-[var(--color-ink-mute)]">
            page {page + 1}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="card-hard px-3 py-1.5 disabled:opacity-30"
            >
              ← prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(jobsQ.data?.length ?? 0) < PER_PAGE}
              className="card-hard px-3 py-1.5 disabled:opacity-30"
            >
              next →
            </button>
          </div>
        </div>
      </div>

      {/* Side */}
      <div className="col-span-12 lg:col-span-3 space-y-5">
        <ManualAddForm />
        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-black text-lg">sources</h3>
            <MonoBadge>{sourcesQ.data?.filter((s) => s.enabled).length ?? 0} on</MonoBadge>
          </div>
          <DashedDivider />
          <div className="mt-3 space-y-3">
            {sourcesQ.data?.map((s) => {
              const display = SOURCE_DISPLAY[s.name] ?? { name: s.name, sub: "" };
              return (
                <div key={s.id} className="flex items-start gap-3">
                  <Switch
                    checked={s.enabled === 1}
                    onCheckedChange={(v) => toggleSource.mutate({ name: s.name, enabled: v })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{display.name}</div>
                    <div className="mono text-[11px] text-[var(--color-ink-mute)] uppercase truncate">
                      {display.sub}
                    </div>
                    {s.lastError && (
                      <div className="mono text-[10px] text-[var(--color-pink)] mt-1 truncate">
                        err: {s.lastError.slice(0, 40)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ManualAddForm() {
  const qc = useQueryClient();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");

  const m = useMutation({
    mutationFn: () => postJson<Job>("/api/jobs", { url, company, role, location: location || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      setCompany(""); setRole(""); setLocation(""); setUrl("");
    },
  });

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Plus className="w-4 h-4" />
        <h3 className="font-black text-lg">add a job</h3>
      </div>
      <DashedDivider />
      <form
        onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        className="space-y-2 mt-3"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://posting-url"
          required
          autoComplete="off"
          suppressHydrationWarning
          className="card-hard !p-2 mono text-xs w-full bg-transparent outline-none"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          required
          autoComplete="off"
          suppressHydrationWarning
          className="card-hard !p-2 text-sm w-full bg-transparent outline-none"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role"
          required
          autoComplete="off"
          suppressHydrationWarning
          className="card-hard !p-2 text-sm w-full bg-transparent outline-none"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          autoComplete="off"
          suppressHydrationWarning
          className="card-hard !p-2 text-sm w-full bg-transparent outline-none"
        />
        <button
          type="submit"
          disabled={m.isPending || !company || !role || !url}
          className="card-hard-pink w-full py-2 text-sm font-bold disabled:opacity-40"
        >
          {m.isPending ? "adding…" : "+ add job"}
        </button>
      </form>
    </Card>
  );
}
