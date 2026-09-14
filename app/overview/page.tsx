"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, patchJson } from "@/lib/ui/fetcher";
import type { OverviewResponse, Settings, Source, Job } from "@/lib/ui/types";
import { Card, MonoBadge, Switch, WavyUnderline, DashedDivider, Pentagon } from "../_components/ui";
import { atsFromUrl, relativeTime } from "@/lib/ui/ats";

function StatBox({ label, value, accent }: { label: string; value: number | string; accent?: "pink" | "blue" }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="mono text-xs uppercase tracking-wider text-[var(--color-ink-mute)]">{label}</div>
      <div className={`text-5xl font-black tracking-tight ${
        accent === "pink" ? "text-[var(--color-pink)]" :
        accent === "blue" ? "text-[var(--color-blue)]" : ""
      }`}>
        {value}
      </div>
    </Card>
  );
}

function PipelineStage({
  label,
  state,
  sublabel,
}: {
  label: string;
  state: "running" | "idle" | "off";
  sublabel?: string;
}) {
  const bg =
    state === "running" ? "bg-[var(--color-pink)] text-white" :
    state === "idle"    ? "bg-[var(--color-blue)] text-white" :
    "bg-[var(--color-cream-200)] text-[var(--color-ink-mute)]";
  return (
    <div className={`card-hard ${bg} px-5 py-4 min-w-[180px]`}>
      <div className="mono text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-bold text-lg mt-1">
        {state === "running" ? "running" : state === "idle" ? "idle" : "off"}
      </div>
      {sublabel && <div className="mono text-xs opacity-70 mt-1">{sublabel}</div>}
    </div>
  );
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="mono text-xs uppercase w-20 text-[var(--color-ink-mute)]">{label}</div>
      <div className="flex-1 relative h-7 border-2 border-[var(--color-ink)] bg-[var(--color-cream-200)]">
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-pink)]"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mono font-bold text-lg w-12 text-right">{value}</div>
    </div>
  );
}

type ToggleKind = "scraper" | "tracker" | "enricher";
const ENABLED_KEY: Record<ToggleKind, keyof Settings> = {
  scraper: "scraperEnabled",
  tracker: "trackerEnabled",
  enricher: "enrichEnabled",
};

function MasterToggle({ kind }: { kind: ToggleKind }) {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchJson<Settings>("/api/settings"),
  });
  const sources = useQuery({
    queryKey: ["sources"],
    queryFn: () => fetchJson<Source[]>("/api/sources"),
  });
  const m = useMutation({
    mutationFn: (enabled: boolean) =>
      patchJson<Settings>("/api/settings", { [ENABLED_KEY[kind]]: enabled ? 1 : 0 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const enabled = settings.data ? (settings.data[ENABLED_KEY[kind]] as number) === 1 : false;
  const intervalMin = settings.data
    ? kind === "scraper" ? settings.data.scraperIntervalMin
    : kind === "tracker" ? settings.data.trackerIntervalMin
    : settings.data.enrichIntervalMin
    : 0;

  // For the scraper, "LAST" is the most recent source.lastRunAt across all
  // sources. For the tracker, it's settings.trackerLastRunAt — stamped by
  // tickTracker on every cycle. Earlier this was gmailConnectedAt by mistake,
  // which showed "51h ago" forever because that's when you first authorized.
  const lastRun =
    kind === "scraper"
      ? sources.data?.reduce<number | null>((acc, s) => (s.lastRunAt && (!acc || s.lastRunAt > acc)) ? s.lastRunAt : acc, null) ?? null
      : kind === "tracker"
        ? settings.data?.trackerLastRunAt ?? null
        : settings.data?.enrichLastRunAt ?? null;
  const lastInserted =
    kind === "tracker" ? settings.data?.trackerLastInserted ?? null
    : kind === "enricher" ? settings.data?.enrichLastCount ?? null
    : null;
  const lastError =
    kind === "tracker" ? settings.data?.trackerLastError ?? null
    : kind === "enricher" ? settings.data?.enrichLastError ?? null
    : null;

  const subtitle =
    kind === "scraper"
      ? `${sources.data?.filter((s) => s.enabled).length ?? 0}/${sources.data?.length ?? 0} sources · ${intervalMin}m interval`
      : kind === "tracker"
        ? `gmail · ${intervalMin}m interval`
        : `salary from links · ${intervalMin}m interval`;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="mono text-xs uppercase tracking-wider text-[var(--color-ink-mute)]">{kind}</div>
          <div className="text-2xl font-bold mt-1">{enabled ? "running" : "off"}</div>
        </div>
        <Switch checked={enabled} onCheckedChange={(v) => m.mutate(v)} />
      </div>
      <div className="mono text-xs text-[var(--color-ink-mute)]">{subtitle}</div>
      <DashedDivider />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)]">last</div>
          <div className="mono text-sm" title={lastError ? `Error: ${lastError}` : undefined}>
            {lastError
              ? `err · ${lastError.slice(0, 18)}`
              : lastInserted != null
                ? `${relativeTime(lastRun)} · +${lastInserted}`
                : relativeTime(lastRun)}
          </div>
        </div>
        <div>
          <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)]">next</div>
          {/* Real countdown from the last actual run, not just the configured
              interval — "in 3m" forever while the timer was dead is how a
              16-hour tracker outage went unnoticed. "overdue" = the heartbeat
              should catch it on the next /api/settings poll. */}
          <div className="mono text-sm">
            {!enabled || !lastRun
              ? "—"
              : (() => {
                  const dueIn = Math.round((lastRun + intervalMin * 60 - Date.now() / 1000) / 60);
                  return dueIn > 0 ? `in ${dueIn}m` : "overdue";
                })()}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Compose a one-line health blurb per source:
 *   "err · {first 20 chars}"   — last run threw
 *   "—"                        — never run
 *   "2m · +3"                  — last run found 3 new rows
 *   "2m · +0 · last 3d"        — last run found nothing, but the last successful
 *                                insert was 3 days ago (helps spot upstream droughts)
 *   "2m · +0"                  — no inserts ever, last run was 2 min ago
 * Why this matters: `lastCount` (items returned) is roughly constant across
 * runs, so it can't tell the user whether the scraper is actually picking up
 * new postings. `lastInserted` is the true signal.
 */
function sourceStatusLine(s: Source): string {
  if (s.lastError) return `err · ${s.lastError.slice(0, 20)}`;
  if (!s.lastRunAt) return "—";
  const ran = relativeTime(s.lastRunAt);
  if (s.lastInserted == null) return ran;
  if (s.lastInserted > 0) return `${ran} · +${s.lastInserted}`;
  if (s.lastInsertedAt) return `${ran} · +0 · last ${relativeTime(s.lastInsertedAt)}`;
  return `${ran} · +0`;
}

function sourceTooltip(s: Source): string {
  const parts: string[] = [];
  if (s.lastRunAt) parts.push(`Last run: ${new Date(s.lastRunAt * 1000).toLocaleString()}`);
  if (s.lastCount != null) parts.push(`Items returned: ${s.lastCount}`);
  if (s.lastInserted != null) parts.push(`New rows this run: ${s.lastInserted}`);
  if (s.lastInsertedAt) parts.push(`Last successful new row: ${new Date(s.lastInsertedAt * 1000).toLocaleString()}`);
  if (s.lastError) parts.push(`Error: ${s.lastError}`);
  return parts.join("\n");
}

function SourceHealth() {
  const sources = useQuery({
    queryKey: ["sources"],
    queryFn: () => fetchJson<Source[]>("/api/sources"),
  });
  const enabled = sources.data?.filter((s) => s.enabled).length ?? 0;
  const total = sources.data?.length ?? 0;
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-black text-xl">source health</h3>
        <MonoBadge>{enabled}/{total} enabled</MonoBadge>
      </div>
      <DashedDivider />
      <div className="mt-3 space-y-2">
        {sources.data?.map((s) => (
          <div key={s.id} className="flex items-center gap-3 py-1" title={sourceTooltip(s)}>
            <span className={`w-2 h-2 rounded-full ${s.enabled ? "bg-[var(--color-pink)]" : "bg-[var(--color-ink-mute)]"}`} />
            <span className="mono text-sm flex-1 truncate">{s.name}</span>
            <span className="mono text-xs text-[var(--color-ink-mute)]">
              {sourceStatusLine(s)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentJobs() {
  const jobs = useQuery({
    queryKey: ["recent-jobs"],
    queryFn: () => fetchJson<Job[]>("/api/jobs?limit=8"),
  });
  return (
    <Card>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-black text-xl">recent jobs</h3>
        <MonoBadge>top 8 · newest</MonoBadge>
      </div>
      <DashedDivider />
      <div className="mt-3 space-y-2">
        {jobs.data?.slice(0, 8).map((j) => {
          const ats = atsFromUrl(j.url);
          return (
            <a
              key={j.id}
              href={j.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 py-1 hover:bg-[var(--color-cream-200)] -mx-2 px-2 rounded"
            >
              <MonoBadge variant={ats.code === "GH" ? "pink" : ats.code === "DIR" ? "default" : "blue"} className="w-9 justify-center">
                {ats.code}
              </MonoBadge>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{j.company}</div>
                <div className="mono text-xs text-[var(--color-ink-mute)] truncate uppercase">{j.role}</div>
              </div>
              <span className="mono text-xs text-[var(--color-ink-mute)]">{relativeTime(j.postedAt ?? j.scrapedAt)}</span>
            </a>
          );
        }) ?? (
          <div className="mono text-xs text-[var(--color-ink-mute)] py-4 text-center">
            no jobs yet — enable the scraper to start collecting
          </div>
        )}
      </div>
    </Card>
  );
}

export default function OverviewPage() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => fetchJson<OverviewResponse>("/api/overview"),
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchJson<Settings>("/api/settings"),
  });

  // Run number is set in an effect so SSR and first client render both show
  // "—". Computing Date.now() during render hydration-mismatches whenever the
  // minute ticks over between server render and client hydrate.
  const [runNo, setRunNo] = useState<number | null>(null);
  useEffect(() => {
    setRunNo(Math.floor(Date.now() / 60000) % 1000);
  }, []);

  const counts = overview.data?.statusCounts;
  const appliedTotal = counts ? counts.applied + counts.screen + counts.interview + counts.offer + counts.rejected : 0;
  const maxFunnel = counts ? Math.max(counts.applied, counts.screen, counts.interview, counts.offer, 1) : 1;

  return (
    <div className="grid grid-cols-12 gap-6 mt-4">
      {/* Main column */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        {/* Headline */}
        <Card className="!p-7 relative">
          <div className="mono text-[11px] uppercase tracking-wider text-[var(--color-pink)] mb-2">
            · field report · run №{runNo ?? "—"} ·
          </div>
          <h1 className="headline text-6xl">
            eight applications before <em className="not-italic relative inline-block">breakfast<WavyUnderline /></em>,
            <br />
            one offer by <span className="text-[var(--color-blue)] italic">friday?</span>
          </h1>
          <p className="text-[var(--color-ink-mute)] mt-4 max-w-xl text-sm leading-relaxed">
            Scraper pulls the boards hourly. Tracker reads Gmail every few minutes
            and files what it finds. You just apply.
          </p>
          <div className="absolute top-6 right-6">
            <Pentagon className="w-10 h-10" />
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <StatBox label="posted" value={overview.data?.jobsTotal ?? "—"} />
          <StatBox label="open" value={overview.data?.jobsOpen ?? "—"} accent="blue" />
          <StatBox label="applied" value={appliedTotal} accent="pink" />
          <StatBox label="offers" value={counts?.offer ?? 0} />
        </div>

        {/* Pipeline */}
        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-black text-xl">pipeline</h3>
            <MonoBadge>2 stages · {settings.data?.scraperEnabled ? "scrape on" : "scrape off"} · {settings.data?.trackerEnabled ? "track on" : "track off"}</MonoBadge>
          </div>
          <DashedDivider />
          <div className="flex items-center gap-3 mt-4">
            <PipelineStage label="01 scrape" state={settings.data?.scraperEnabled ? "running" : "off"} sublabel="github sources" />
            <span className="mono text-2xl text-[var(--color-ink-mute)]">→</span>
            <PipelineStage label="02 track" state={settings.data?.trackerEnabled ? "running" : "off"} sublabel={settings.data?.gmailConnectedAt ? "gmail · connected" : "gmail · not connected"} />
          </div>
        </Card>

        {/* Funnel */}
        <Card>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-black text-xl">funnel</h3>
            <MonoBadge>all-time</MonoBadge>
          </div>
          <DashedDivider />
          <div className="space-y-2.5 mt-4">
            <FunnelBar label="applied" value={counts?.applied ?? 0} max={maxFunnel} />
            <FunnelBar label="screen" value={counts?.screen ?? 0} max={maxFunnel} />
            <FunnelBar label="interview" value={counts?.interview ?? 0} max={maxFunnel} />
            <FunnelBar label="★ offer" value={counts?.offer ?? 0} max={maxFunnel} />
          </div>
        </Card>
      </div>

      {/* Side column */}
      <div className="col-span-12 lg:col-span-4 space-y-6">
        <MasterToggle kind="scraper" />
        <MasterToggle kind="tracker" />
        <MasterToggle kind="enricher" />
        <SourceHealth />
        <RecentJobs />
      </div>
    </div>
  );
}
