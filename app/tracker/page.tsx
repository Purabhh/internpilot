"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, patchJson, deleteJson } from "@/lib/ui/fetcher";
import type { Application, Status } from "@/lib/ui/types";
import { Card, MonoBadge, DashedDivider, WavyUnderline } from "../_components/ui";
import { atsFromUrl, daysSince } from "@/lib/ui/ats";
import { Trash2, ArrowUpRight, Search, Star } from "lucide-react";

// "saved" sits leftmost: it's the pre-application stage (bookmarked from the
// jobs board to apply to later). The email pipeline flips a saved card to
// "applied" on its own once a confirmation lands, or you can drag it over.
const COLUMNS: Array<{ status: Status; label: string; pink?: boolean }> = [
  { status: "saved",     label: "saved" },
  { status: "applied",   label: "applied" },
  { status: "screen",    label: "screen" },
  { status: "interview", label: "interview" },
  { status: "offer",     label: "★ offer", pink: true },
  { status: "rejected",  label: "rejected" },
];

type EditField = "company" | "role" | "notes";

const postingAgeDays = (unixSec: number) => Math.floor((Date.now() / 1000 - unixSec) / 86400);

function ApplicationCard({
  app,
  onMove,
  onDelete,
  onEdit,
}: {
  app: Application;
  onMove: (id: number, status: Status) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, patch: { company?: string; role?: string; notes?: string | null; priority?: boolean }) => void;
}) {
  const ats = atsFromUrl(app.url);
  const isOffer = app.status === "offer";
  const [editField, setEditField] = useState<EditField | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (field: EditField, current: string) => {
    setDraft(current);
    setEditField(field);
  };
  const commit = () => {
    const field = editField;
    setEditField(null);
    if (!field) return;
    if (field === "notes") {
      // Notes may be cleared; company/role may not (blank = no-op revert).
      if (draft !== (app.notes ?? "")) onEdit(app.id, { notes: draft || null });
    } else {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== app[field]) onEdit(app.id, { [field]: trimmed });
    }
  };
  // Shared key handling: Enter commits, Escape cancels without saving.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && editField !== "notes") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") setEditField(null);
  };
  // Guards that keep an input usable inside the draggable card.
  const noDrag = {
    draggable: false,
    onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  };

  return (
    <div
      className={`card-hard ${isOffer ? "bg-white" : ""} mb-3 p-3 cursor-move group`}
      // Disable dragging entirely while editing so text selection works.
      draggable={editField === null}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(app.id));
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {editField === "company" ? (
          <input
            value={draft}
            autoFocus
            {...noDrag}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
            className="font-bold text-sm flex-1 border-2 border-[var(--color-ink)] px-1 bg-[var(--color-cream-50)] outline-none"
          />
        ) : (
          <button
            {...noDrag}
            onClick={() => startEdit("company", app.company)}
            className="font-bold text-sm truncate flex-1 text-left hover:text-[var(--color-pink)]"
            title="Click to edit company"
          >
            {app.company}
          </button>
        )}
        <MonoBadge variant="default" className="!text-[9px]">{ats.code}</MonoBadge>
      </div>

      {editField === "role" ? (
        <input
          value={draft}
          autoFocus
          {...noDrag}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="mono text-[10px] uppercase w-full mt-0.5 border-2 border-[var(--color-ink)] px-1 bg-[var(--color-cream-50)] outline-none"
        />
      ) : (
        <button
          {...noDrag}
          onClick={() => startEdit("role", app.role)}
          className="mono text-[10px] uppercase text-[var(--color-ink-mute)] truncate text-left w-full block hover:text-[var(--color-ink)]"
          title="Click to edit role"
        >
          {app.role}
        </button>
      )}

      <DashedDivider className="my-2" />

      <div className="flex items-center justify-between mono text-[10px]">
        <span className="text-[var(--color-ink-mute)]">
          {daysSince(app.appliedAt)}
          {/* Saved only: how long the posting has been up, so stale ones stand out. */}
          {app.status === "saved" && app.jobPostedAt && (
            <span
              className={postingAgeDays(app.jobPostedAt) >= 21 ? "text-[var(--color-pink)] font-bold" : ""}
              title="How long the job posting has been open"
            >
              {" · open "}{daysSince(app.jobPostedAt)}
            </span>
          )}
        </span>
        {/*
          stopPropagation on mousedown + draggable={false} prevents the parent
          card's drag-and-drop from eating the click. Without these, any
          mousemove between mousedown and mouseup starts a drag and cancels
          the click — which is why the delete button "didn't respond" to
          spamming. Now the action buttons are click-only and the rest of
          the card remains the drag handle.
        */}
        <div className="flex items-center gap-1.5">
          {app.status === "saved" && (
            <button
              onClick={() => onEdit(app.id, { priority: !app.priority })}
              {...noDrag}
              className={`p-1 -m-1 ${app.priority ? "text-[var(--color-pink)]" : "hover:text-[var(--color-pink)]"}`}
              title={app.priority ? "Unstar" : "Star: definitely apply"}
            >
              <Star className="w-3.5 h-3.5" fill={app.priority ? "currentColor" : "none"} />
            </button>
          )}
          {app.url && (
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              {...noDrag}
              className="hover:text-[var(--color-blue)] p-1 -m-1"
              title="Open"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => onDelete(app.id)}
            {...noDrag}
            className="hover:text-[var(--color-pink)] p-1 -m-1"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {editField === "notes" ? (
        <textarea
          value={draft}
          {...noDrag}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          autoFocus
          rows={2}
          placeholder="notes…"
          className="mt-2 w-full text-[11px] border-2 border-[var(--color-ink)] p-1 bg-[var(--color-cream-50)] mono outline-none"
        />
      ) : (
        <button
          {...noDrag}
          onClick={() => startEdit("notes", app.notes ?? "")}
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
            {...noDrag}
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
  const [search, setSearch] = useState("");
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
    // Optimistic update — strip the card immediately so the click feels
    // responsive even before the request settles. Roll back on error.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["applications"] });
      const prev = qc.getQueryData<Application[]>(["applications"]);
      qc.setQueryData<Application[]>(["applications"], (old) =>
        (old ?? []).filter((a) => a.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["applications"], ctx.prev);
      console.error("[tracker] delete failed:", err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const edit = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { company?: string; role?: string; notes?: string | null; priority?: boolean } }) =>
      patchJson<Application>(`/api/applications/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["applications"] });
      const prev = qc.getQueryData<Application[]>(["applications"]);
      qc.setQueryData<Application[]>(["applications"], (old) =>
        (old ?? []).map((a) => {
          if (a.id !== id) return a;
          const { priority, ...rest } = patch;
          return { ...a, ...rest, ...(priority !== undefined ? { priority: priority ? 1 : 0 } : {}) };
        }),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["applications"], ctx.prev);
      console.error("[tracker] edit failed:", err);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });

  // Search filters by company/role/location/notes (case-insensitive substring).
  // Both the column lists and the per-status stats reflect the filtered set so
  // counts and visible cards stay in sync. The headline keeps the unfiltered
  // total — it's a vibe header, not a metric.
  const filteredApps = useMemo(() => {
    if (!apps.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return apps.data;
    return apps.data.filter((a) =>
      a.company.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      (a.location ?? "").toLowerCase().includes(q) ||
      (a.notes ?? "").toLowerCase().includes(q),
    );
  }, [apps.data, search]);

  // Starred cards first; the stable sort keeps the server's newest-first order
  // within each group, and re-sorts instantly on an optimistic star toggle.
  const byStatus = (status: Status) =>
    filteredApps.filter((a) => a.status === status).sort((a, b) => b.priority - a.priority);
  // "Letters out" means applications actually sent — saved bookmarks aren't
  // out the door yet, so they don't count toward the headline.
  const total = apps.data?.filter((a) => a.status !== "saved").length ?? 0;
  const totalOffers = apps.data?.filter((a) => a.status === "offer").length ?? 0;
  const searchActive = search.trim().length > 0;

  return (
    <div className="mt-4 space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="headline text-6xl">
          {apps.data ? `${total} letters out,` : "loading…"}
          <br />
          <em className="not-italic text-[var(--color-pink)] relative inline-block">
            {totalOffers} offer{totalOffers === 1 ? "" : "s"}<WavyUnderline />
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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="card-hard flex items-center gap-2 px-3 py-2 flex-1 min-w-[280px] max-w-md !p-2 !pl-3">
          <Search className="w-4 h-4 opacity-60" />
          {/*
            autoComplete="off" discourages browser/extension form-detectors from
            tagging this input (Edge's password manager, LastPass, Bitwarden all
            inject `fdprocessedid` attributes which then mismatch React's
            server-rendered HTML). suppressHydrationWarning is the belt-and-
            suspenders: if the extension still tags it, React skips the diff
            check on this single element instead of throwing a hydration error.
          */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search company, role, location, notes…"
            autoComplete="off"
            suppressHydrationWarning
            className="bg-transparent outline-none flex-1 text-sm mono"
          />
        </div>
        {searchActive && (
          <MonoBadge>
            {filteredApps.length} of {total} matching
          </MonoBadge>
        )}
      </div>

      <div className="grid grid-cols-6 gap-3">
        {COLUMNS.map((c) => {
          const items = byStatus(c.status);
          return (
            <div
              key={c.status}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
              onDrop={(e) => {
                e.preventDefault();
                const id = Number(e.dataTransfer.getData("text/plain"));
                if (Number.isFinite(id)) move.mutate({ id, status: c.status });
              }}
              className={`card-hard !p-3 flex flex-col min-h-[60vh] ${c.pink ? "!bg-[var(--color-pink)] text-white" : ""}`}
            >
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="font-black text-base lowercase">{c.label}</h3>
                <span className="mono text-xs opacity-80">{items.length}</span>
              </div>
              <DashedDivider />
              {/*
                Scroll the list (not the column) when there are many cards.
                max-h is tuned so ~3 cards fit before the scrollbar appears;
                pr-1 / -mr-1 keep the scrollbar from misaligning with the column
                padding. flex-1 lets the column keep its visual height even when
                the list is short, so all 6 columns stay aligned.
              */}
              <div className="mt-3 flex-1 max-h-[calc(100vh-340px)] overflow-y-auto pr-1 -mr-1">
                {items.map((app, i) => (
                  <div key={app.id}>
                    {/* Saved column splits into "priority" (starred) and the rest. */}
                    {c.status === "saved" && app.priority === 1 && i === 0 && (
                      <div className="mono text-[10px] uppercase tracking-wider text-[var(--color-pink)] mb-2">★ priority</div>
                    )}
                    {c.status === "saved" && app.priority === 0 && i > 0 && items[i - 1].priority === 1 && (
                      <div className="mono text-[10px] uppercase tracking-wider text-[var(--color-ink-mute)] mt-1 mb-2">the rest</div>
                    )}
                    <ApplicationCard
                      app={app}
                      onMove={(id, status) => move.mutate({ id, status })}
                      onDelete={(id) => del.mutate(id)}
                      onEdit={(id, patch) => edit.mutate({ id, patch })}
                    />
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="mono text-[10px] text-[var(--color-ink-mute)] py-6 text-center">
                    {searchActive ? "no matches" : "empty"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
