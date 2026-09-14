"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, patchJson } from "@/lib/ui/fetcher";
import type { Email, Application, Status, Job } from "@/lib/ui/types";
import { Card, MonoBadge, DashedDivider, WavyUnderline, StatusPill, ConfidenceBar } from "../_components/ui";
import { relativeTime } from "@/lib/ui/ats";
import { Wrench, ChevronDown, ChevronRight } from "lucide-react";

const STATUSES: Status[] = ["applied", "screen", "interview", "offer", "rejected"];

function parseFrom(fromAddr: string | null): { name: string; email: string } {
  if (!fromAddr) return { name: "—", email: "" };
  const m = fromAddr.match(/^(.+?)\s*<(.+)>$/);
  if (m) return { name: m[1]!.replace(/^"|"$/g, "").trim(), email: m[2]! };
  return { name: fromAddr, email: "" };
}

function ClassifierBadge({ email }: { email: Email }) {
  if (email.needsReview === 1) {
    return <MonoBadge variant="pink">NEEDS REVIEW</MonoBadge>;
  }
  if (email.classifier === "rules") return <MonoBadge variant="default">RULES</MonoBadge>;
  if (email.classifier === "llm") return <MonoBadge variant="blue">LLM</MonoBadge>;
  return <MonoBadge variant="default">—</MonoBadge>;
}

function FixForm({
  email,
  applications,
  onDone,
}: {
  email: Email;
  applications: Application[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status | "">(email.classifiedStatus ?? "");
  const [company, setCompany] = useState(email.classifiedCompany ?? "");
  const [appId, setAppId] = useState<number | null>(email.applicationId);
  const [jobId, setJobId] = useState<number | null>(null);
  const [applyToApp, setApplyToApp] = useState(true);

  // Job picker: search the board (seeded with the classified company) so the
  // user can attach the email to a specific posting. Picking a job creates an
  // application from it — real role/location/url — instead of "(unknown role)".
  const [jobSearch, setJobSearch] = useState(email.classifiedCompany ?? "");
  const [debouncedJobSearch, setDebouncedJobSearch] = useState(jobSearch.trim());
  useEffect(() => {
    const t = setTimeout(() => setDebouncedJobSearch(jobSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [jobSearch]);
  const jobs = useQuery({
    queryKey: ["jobs-pick", debouncedJobSearch],
    queryFn: () => fetchJson<Job[]>(`/api/jobs?q=${encodeURIComponent(debouncedJobSearch)}&limit=6`),
    enabled: debouncedJobSearch.length > 0,
  });

  const m = useMutation({
    mutationFn: () =>
      patchJson(`/api/emails/${email.id}`, {
        classifiedStatus: status || undefined,
        classifiedCompany: company || undefined,
        applicationId: appId,
        jobId: jobId ?? undefined,
        applyToApplication: applyToApp,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] }); // prefix-matches all pages
      qc.invalidateQueries({ queryKey: ["emails-count"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      onDone();
    },
  });

  return (
    <div className="border-t-2 border-dashed border-[var(--color-ink)]/40 mt-3 pt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mb-1">fix status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "")}
            className="card-hard !p-1.5 w-full text-sm mono"
          >
            <option value="">—</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mb-1">company</div>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoComplete="off"
            suppressHydrationWarning
            className="card-hard !p-1.5 w-full text-sm bg-transparent outline-none"
          />
        </div>
      </div>
      <div>
        <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mb-1">link to application</div>
        <select
          value={appId ?? ""}
          onChange={(e) => {
            setAppId(e.target.value ? Number(e.target.value) : null);
            setJobId(null); // app and job links are mutually exclusive
          }}
          className="card-hard !p-1.5 w-full text-sm mono"
        >
          <option value="">— none —</option>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company} · {a.role} · {a.status}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mb-1">
          …or pick the job posting (fills role & company)
        </div>
        <input
          value={jobSearch}
          onChange={(e) => setJobSearch(e.target.value)}
          autoComplete="off"
          suppressHydrationWarning
          placeholder="search the board…"
          className="card-hard !p-1.5 w-full text-sm mono bg-transparent outline-none"
        />
        {debouncedJobSearch.length > 0 && (
          <div className="mt-1.5 space-y-1 max-h-44 overflow-y-auto">
            {jobs.isLoading && (
              <div className="mono text-[10px] text-[var(--color-ink-mute)] py-1">searching…</div>
            )}
            {jobs.data?.length === 0 && (
              <div className="mono text-[10px] text-[var(--color-ink-mute)] py-1">no matching jobs</div>
            )}
            {jobs.data?.map((j) => {
              const selected = jobId === j.id;
              return (
                <button
                  key={j.id}
                  onClick={() => {
                    setJobId(selected ? null : j.id);
                    if (!selected) setAppId(null); // job and app links are mutually exclusive
                  }}
                  className={`w-full text-left px-2 py-1 border-2 border-[var(--color-ink)] text-xs ${
                    selected ? "bg-[var(--color-pink)] text-white" : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
                  }`}
                >
                  <div className="font-bold truncate">{j.company}</div>
                  <div className="mono text-[10px] uppercase truncate opacity-80">
                    {j.role}{j.location ? ` · ${j.location}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <label className="inline-flex items-center gap-2 mono text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={applyToApp}
          onChange={(e) => setApplyToApp(e.target.checked)}
          className="w-3 h-3"
        />
        also update that application's status
      </label>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="card-hard-pink px-3 py-1.5 text-xs font-bold disabled:opacity-40"
        >
          {m.isPending ? "saving…" : "save fix"}
        </button>
        <button
          onClick={onDone}
          className="card-hard px-3 py-1.5 text-xs"
        >
          cancel
        </button>
      </div>
    </div>
  );
}

const PER_PAGE = 50;

export default function EmailsPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fixing, setFixing] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  // One page of emails at a time. keepPreviousData keeps the current page on
  // screen while the next one loads, so flipping doesn't flash empty. Each page
  // is cached by key, so flipping back is instant.
  const emails = useQuery({
    queryKey: ["emails", page],
    queryFn: () => fetchJson<Email[]>(`/api/emails?limit=${PER_PAGE}&offset=${page * PER_PAGE}`),
    placeholderData: keepPreviousData,
  });
  // Totals come from a cheap COUNT, not from counting a fetched array — so the
  // header and pagination know the full size without loading every row.
  const counts = useQuery({
    queryKey: ["emails-count"],
    queryFn: () => fetchJson<{ total: number; needsReview: number }>("/api/emails/count"),
  });
  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchJson<Application[]>("/api/applications"),
  });

  const total = counts.data?.total ?? 0;
  const needsReview = counts.data?.needsReview ?? 0;
  const pageRows = emails.data?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const rangeStart = total === 0 ? 0 : page * PER_PAGE + 1;
  const rangeEnd = page * PER_PAGE + pageRows;

  return (
    <div className="mt-4 space-y-5">
      <div>
        <h1 className="headline text-6xl">
          your <em className="not-italic text-[var(--color-pink)] relative inline-block">
            inbox<WavyUnderline />
          </em>, classified.
        </h1>
        <p className="text-[var(--color-ink-mute)] mt-3 text-sm">
          {total} email{total === 1 ? "" : "s"} processed
          {needsReview > 0 && (
            <> · <span className="text-[var(--color-pink)] font-bold">{needsReview}</span> need review</>
          )}
        </p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="grid grid-cols-[20px_2fr_3fr_1fr_140px_100px] mono text-[10px] uppercase tracking-wider text-[var(--color-ink-mute)] px-4 py-3 border-b-2 border-[var(--color-ink)]">
          <div></div>
          <div>From</div>
          <div>Subject</div>
          <div>Detected</div>
          <div>Confidence</div>
          <div>Classifier</div>
        </div>
        {emails.isLoading && (
          <div className="px-5 py-10 mono text-sm text-[var(--color-ink-mute)] text-center">loading…</div>
        )}
        {!emails.isLoading && total === 0 && (
          <div className="px-5 py-10 mono text-sm text-[var(--color-ink-mute)] text-center">
            no emails yet — connect Gmail and enable the tracker daemon
          </div>
        )}
        {emails.data?.map((e) => {
          const isOpen = expanded === e.id;
          const isFixing = fixing === e.id;
          const fromParsed = parseFrom(e.fromAddr);
          return (
            <div key={e.id} className="border-b border-dashed border-[var(--color-ink)]/30">
              <button
                onClick={() => setExpanded(isOpen ? null : e.id)}
                className="w-full grid grid-cols-[20px_2fr_3fr_1fr_140px_100px] items-center gap-2 px-4 py-3 hover:bg-[var(--color-cream-200)] text-left"
              >
                <div className="text-[var(--color-ink-mute)]">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{fromParsed.name}</div>
                  <div className="mono text-[10px] text-[var(--color-ink-mute)] truncate">{fromParsed.email}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm truncate">{e.subject ?? "—"}</div>
                  <div className="mono text-[10px] text-[var(--color-ink-mute)]">{relativeTime(e.receivedAt)}</div>
                </div>
                <div className="text-sm truncate">
                  <div className="font-bold">{e.classifiedCompany ?? "—"}</div>
                  <StatusPill status={e.classifiedStatus} />
                </div>
                <div>
                  <ConfidenceBar value={e.confidence} />
                </div>
                <div className="flex items-center justify-between gap-1">
                  <ClassifierBadge email={e} />
                </div>
              </button>
              {isOpen && (
                <div className="px-10 py-4 bg-[var(--color-cream-50)]">
                  <div className="mono text-xs leading-relaxed text-[var(--color-ink)] mb-3 italic">
                    {e.snippet ?? "(no snippet)"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setFixing(isFixing ? null : e.id); }}
                      className="card-hard-pink px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"
                    >
                      <Wrench className="w-3 h-3" /> fix
                    </button>
                  </div>
                  {isFixing && applications.data && (
                    <FixForm
                      email={e}
                      applications={applications.data}
                      onDone={() => setFixing(null)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {total > PER_PAGE && (
        <div className="flex items-center justify-between mono text-sm">
          <div className="text-[var(--color-ink-mute)]">
            {rangeStart}–{rangeEnd} of {total} · page {page + 1}/{pageCount}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setPage((p) => Math.max(0, p - 1)); setExpanded(null); setFixing(null); }}
              disabled={page === 0}
              className="card-hard px-3 py-1.5 disabled:opacity-30"
            >
              ← prev
            </button>
            <button
              onClick={() => { setPage((p) => p + 1); setExpanded(null); setFixing(null); }}
              disabled={page + 1 >= pageCount}
              className="card-hard px-3 py-1.5 disabled:opacity-30"
            >
              next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
