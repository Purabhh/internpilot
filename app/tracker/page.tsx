"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, patchJson, deleteJson } from "@/lib/ui/fetcher";
import type { Application, Status } from "@/lib/ui/types";
import { Card, MonoBadge, DashedDivider, WavyUnderline } from "../_components/ui";
import { atsFromUrl, daysSince } from "@/lib/ui/ats";
import { Trash2, ArrowUpRight } from "lucide-react";

const COLUMNS: Array<{ status: Status; label: string; pink?: boolean }> = [
  { status: "applied",   label: "applied" },
  { status: "screen",    label: "screen" },
  { status: "interview", label: "interview" },
  { status: "offer",     label: "★ offer", pink: true },
  { status: "rejected",  label: "rejected" },
];

function ApplicationCard({
  app,
  onMove,
  onDelete,
}: {
  app: Application;
  onMove: (id: number, status: Status) => void;
  onDelete: (id: number) => void;
}) {
  const ats = atsFromUrl(app.url);
  const isOffer = app.status === "offer";
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(app.notes ?? "");
  return (
    <div
      className={`card-hard ${isOffer ? "bg-white" : ""} mb-3 p-3 cursor-move group`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(app.id));
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-sm truncate flex-1">{app.company}</div>
        <MonoBadge variant="default" className="!text-[9px]">{ats.code}</MonoBadge>
      </div>
      <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)] truncate">{app.role}</div>

      <DashedDivider className="my-2" />

      <div className="flex items-center justify-between mono text-[10px]">
        <span className="text-[var(--color-ink-mute)]">{daysSince(app.appliedAt)}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--color-blue)]"
              title="Open"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => onDelete(app.id)}
            className="hover:text-[var(--color-pink)]"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (notes !== (app.notes ?? "")) {
              patchJson(`/api/applications/${app.id}`, { notes });
            }
          }}
          autoFocus
          rows={2}
          placeholder="notes…"
          className="mt-2 w-full text-[11px] border-2 border-[var(--color-ink)] p-1 bg-[var(--color-cream-50)] mono outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-left w-full text-[11px] text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] mono italic"
        >
          {app.notes || "+ add note"}
        </button>
      )}

      {/* Move dropdown (always visible at bottom for non-drag users) */}
      <div className="mt-2 flex flex-wrap gap-1">
        {COLUMNS.filter((c) => c.status !== app.status).map((c) => (
          <button
            key={c.status}
            onClick={() => onMove(app.id, c.status)}
            className="mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-[var(--color-ink)]/40 hover:bg-[var(--color-ink)] hover:text-white"
          >
            → {c.status}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TrackerPage() {
  const qc = useQueryClient();
  const apps = useQuery({
    queryKey: ["applications"],
    queryFn: () => fetchJson<Application[]>("/api/applications"),
  });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Status }) =>
      patchJson<Application>(`/api/applications/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["applications"] });
      const prev = qc.getQueryData<Application[]>(["applications"]);
      qc.setQueryData<Application[]>(["applications"], (old) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, status } : a)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["applications"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => deleteJson(`/api/applications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const byStatus = (status: Status) => apps.data?.filter((a) => a.status === status) ?? [];
  const total = apps.data?.length ?? 0;
  const offers = byStatus("offer").length;

  return (
    <div className="mt-4 space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="headline text-6xl">
          {apps.data ? `${total} letters out,` : "loading…"}
          <br />
          <em className="not-italic text-[var(--color-pink)] relative inline-block">
            {offers} offer{offers === 1 ? "" : "s"}<WavyUnderline />
          </em>{" "}
          <span className="text-[var(--color-blue)] italic">back.</span>
        </h1>
        <div className="flex items-center gap-3 mono text-xs uppercase">
          {COLUMNS.map((c) => (
            <div key={c.status} className="text-center">
              <div className="text-[10px] text-[var(--color-ink-mute)]">{c.label}</div>
              <div className={`text-2xl font-black ${c.pink ? "text-[var(--color-pink)]" : ""}`}>
                {byStatus(c.status).length}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {COLUMNS.map((c) => (
          <div
            key={c.status}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (Number.isFinite(id)) move.mutate({ id, status: c.status });
            }}
            className={`card-hard !p-3 min-h-[60vh] ${c.pink ? "!bg-[var(--color-pink)] text-white" : ""}`}
          >
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-black text-base lowercase">{c.label}</h3>
              <span className="mono text-xs opacity-80">{byStatus(c.status).length}</span>
            </div>
            <DashedDivider />
            <div className="mt-3">
              {byStatus(c.status).map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  onMove={(id, status) => move.mutate({ id, status })}
                  onDelete={(id) => del.mutate(id)}
                />
              ))}
              {byStatus(c.status).length === 0 && (
                <div className="mono text-[10px] text-[var(--color-ink-mute)] py-6 text-center">
                  empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
