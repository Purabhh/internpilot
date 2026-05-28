"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, patchJson } from "@/lib/ui/fetcher";
import type { Email, Application, Status } from "@/lib/ui/types";
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
  const [applyToApp, setApplyToApp] = useState(true);

  const m = useMutation({
    mutationFn: () =>
      patchJson(`/api/emails/${email.id}`, {
        classifiedStatus: status || undefined,
        classifiedCompany: company || undefined,
        applicationId: appId,
        applyToApplication: applyToApp,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
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
            className="card-hard !p-1.5 w-full text-sm bg-transparent outline-none"
          />
        </div>
      </div>
      <div>
        <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)] mb-1">link to application</div>
        <select
          value={appId ?? ""}
          onChange={(e) => setAppId(e.target.value ? Number(e.target.value) : null)}
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

export default function EmailsPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fixing, setFixing] = useState<number | null>(null);

  const emails = useQuery({
    queryKey: ["emails"],
    queryFn: () => fetchJson<Email[]>("/api/emails?limit=200"),
  });
  const applications = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchJson<Application[]>("/api/applications"),
  });

  const needsReview = emails.data?.filter((e) => e.needsReview === 1).length ?? 0;
  const total = emails.data?.length ?? 0;

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
    </div>
  );
}
