"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, ArrowUpRight, Search, Plus } from "lucide-react";
import { fetchJson, patchJson, postJson } from "@/lib/ui/fetcher";
import type { Job, Source } from "@/lib/ui/types";
import { Card, MonoBadge, DashedDivider, Switch, WavyUnderline } from "../_components/ui";
import { atsFromUrl, relativeTime } from "@/lib/ui/ats";

const SOURCE_DISPLAY: Record<string, { name: string; sub: string }> = {
  simplify_summer26_offseason: { name: "Simplify", sub: "Off-Season Internships" },
  simplify_newgrad: { name: "Simplify", sub: "New Grad" },
  vansh_summer27_offseason: { name: "Vansh", sub: "Off-Season Internships" },
  speedyapply_swe26: { name: "SpeedyApply", sub: "SWE (parser deferred)" },
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

export default function JobsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [maxAgeDays, setMaxAgeDays] = useState<number | null>(90); // default 90d
  const PER_PAGE = 30;

  const jobsQ = useQuery({
    queryKey: ["jobs", page, maxAgeDays],
    queryFn: () => {
      const params = new URLSearchParams({
        limit: String(PER_PAGE),
        offset: String(page * PER_PAGE),
      });
      if (maxAgeDays != null) params.set("maxAgeDays", String(maxAgeDays));
      return fetchJson<Job[]>(`/api/jobs?${params.toString()}`);
    },
  });
  const sourcesQ = useQuery({
    queryKey: ["sources"],
    queryFn: () => fetchJson<Source[]>("/api/sources"),
  });

  const action = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "applied" | "dismiss" }) =>
      patchJson<unknown>(`/api/jobs/${id}`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const toggleSource = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      patchJson<unknown>("/api/sources", { name, enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources"] }),
  });

  const filtered = useMemo(() => {
    if (!jobsQ.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return jobsQ.data;
    return jobsQ.data.filter(
      (j) =>
        j.company.toLowerCase().includes(q) ||
        j.role.toLowerCase().includes(q) ||
        (j.location ?? "").toLowerCase().includes(q),
    );
  }, [jobsQ.data, search]);

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
            {jobsQ.data?.length ?? 0} jobs on this page · {filtered.length} shown · click → to open
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
          <MonoBadge>{filtered.length} matching</MonoBadge>
        </div>

        {/* Table */}
        <Card className="!p-0 overflow-hidden">
          <div className="grid grid-cols-[2.5fr_1.2fr_60px_80px_120px] mono text-[10px] uppercase tracking-wider text-[var(--color-ink-mute)] px-5 py-3 border-b-2 border-[var(--color-ink)]">
            <div>Company / Role</div>
            <div>Location</div>
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
            return (
              <div
                key={j.id}
                className="grid grid-cols-[2.5fr_1.2fr_60px_80px_120px] items-center px-5 py-3 border-b border-dashed border-[var(--color-ink)]/30 hover:bg-[var(--color-cream-200)]"
              >
                <div className="min-w-0">
                  <div className="font-bold truncate">{j.company}</div>
                  <div className="mono text-xs text-[var(--color-ink-mute)] uppercase truncate">{j.role}</div>
                </div>
                <div className="mono text-xs text-[var(--color-ink-mute)] truncate">{j.location ?? "—"}</div>
                <div>
                  <MonoBadge variant={atsVariant(ats.code)}>{ats.code}</MonoBadge>
                </div>
                <div className="mono text-xs text-[var(--color-ink-mute)]" title={j.postedAt ? new Date(j.postedAt * 1000).toLocaleString() : "Posted date unknown — using scrape time"}>
                  {relativeTime(j.postedAt ?? j.scrapedAt)}
                </div>
                <div className="flex items-center justify-end gap-1.5">
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
          className="card-hard !p-2 mono text-xs w-full bg-transparent outline-none"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company"
          required
          className="card-hard !p-2 text-sm w-full bg-transparent outline-none"
        />
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role"
          required
          className="card-hard !p-2 text-sm w-full bg-transparent outline-none"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
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
