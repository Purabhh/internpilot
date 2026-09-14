"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, patchJson, deleteJson } from "@/lib/ui/fetcher";
import type { Resume } from "@/lib/ui/types";
import { Card, MonoBadge, StickyTag, DashedDivider, WavyUnderline } from "../_components/ui";
import { relativeTime } from "@/lib/ui/ats";
import { Upload, Star, Trash2 } from "lucide-react";

export default function ResumesPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resumes = useQuery({
    queryKey: ["resumes"],
    queryFn: () => fetchJson<Resume[]>("/api/resumes"),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error("title + file required");
      const fd = new FormData();
      fd.append("title", title);
      fd.append("file", file);
      const res = await fetch("/api/resumes", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return res.json();
    },
    onSuccess: () => {
      setTitle("");
      setFile(null);
      setError(null);
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["resumes"] });
      qc.invalidateQueries({ queryKey: ["resumes-count"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => patchJson<Resume>(`/api/resumes/${id}`, { setDefault: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resumes"] }),
  });
  const rename = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      patchJson<Resume>(`/api/resumes/${id}`, { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resumes"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteJson(`/api/resumes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resumes"] });
      qc.invalidateQueries({ queryKey: ["resumes-count"] });
    },
  });

  const total = resumes.data?.length ?? 0;
  const defaultResume = resumes.data?.find((r) => r.isDefault === 1);
  const totalSize = resumes.data?.reduce((acc, _r) => acc + 0, 0) ?? 0;

  return (
    <div className="mt-4 grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-9 space-y-6">
        <div>
          <h1 className="headline text-6xl">
            your <em className="not-italic text-[var(--color-pink)] relative inline-block">
              resumes<WavyUnderline />
            </em>, your way.
          </h1>
          <p className="text-[var(--color-ink-mute)] mt-3 text-sm">
            Upload a .docx or .pdf, give it a title — "Embedded SWE", "Risk draft", anything.
          </p>
        </div>

        {/* Upload form */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-4 h-4" />
            <h3 className="font-black text-lg">file a new resume.</h3>
          </div>
          <DashedDivider />
          <div className="mt-4 flex flex-col md:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="title — e.g. Embedded SWE"
                autoComplete="off"
                suppressHydrationWarning
                className="card-hard !p-2.5 w-full text-sm bg-transparent outline-none"
              />
              <button
                onClick={() => upload.mutate()}
                disabled={!file || !title.trim() || upload.isPending}
                className="card-hard-pink w-full py-2.5 text-sm font-bold disabled:opacity-40"
              >
                {upload.isPending ? "filing…" : "+ file it"}
              </button>
            </div>
            <label className="flex-1 card-hard border-dashed !border-[var(--color-ink)] flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--color-cream-200)] min-h-[120px]">
              <Upload className="w-6 h-6 mb-2 text-[var(--color-pink)]" />
              <span className="mono text-xs uppercase text-[var(--color-ink-mute)]">
                {file ? file.name : "drop .docx or .pdf · or browse"}
              </span>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>
          {error && <div className="mono text-xs text-[var(--color-pink)] mt-2">{error}</div>}
        </Card>

        {/* Grid */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-black text-xl lowercase">on file</h3>
            <span className="mono text-xs text-[var(--color-ink-mute)]">
              sort: recency ↓ · {total} item{total === 1 ? "" : "s"}
            </span>
          </div>

          {total === 0 ? (
            <Card className="text-center py-12">
              <div className="mono text-sm text-[var(--color-ink-mute)]">
                no resumes yet — upload one above to get started
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {resumes.data?.map((r, idx) => {
                const isDefault = r.isDefault === 1;
                const isPdf = r.mimeType === "application/pdf";
                return (
                  <div key={r.id} className={`relative ${isDefault ? "card-hard-pink" : "card-hard"} p-4`}>
                    {isDefault && (
                      <StickyTag color="black" className="top-2 right-2 left-auto">
                        ★ DEFAULT
                      </StickyTag>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <span className="mono text-[10px] uppercase opacity-70">№ {String(idx + 1).padStart(2, "0")}</span>
                      <MonoBadge variant={isDefault ? "black" : "blue"}>
                        .{isPdf ? "pdf" : "docx"}
                      </MonoBadge>
                    </div>
                    <h4
                      className="font-bold text-xl mb-2 cursor-text"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const next = e.currentTarget.textContent?.trim() ?? "";
                        if (next && next !== r.title) rename.mutate({ id: r.id, title: next });
                      }}
                    >
                      {r.title}
                    </h4>
                    <div className="mono text-[11px] opacity-80 truncate">{r.filename}</div>
                    <div className="mono text-[11px] opacity-70 mt-1">
                      uploaded {relativeTime(r.uploadedAt)} · used {r.usedCount}×
                    </div>
                    <DashedDivider className="my-3" />
                    <div className="flex items-center gap-2">
                      {!isDefault && (
                        <button
                          onClick={() => setDefault.mutate(r.id)}
                          className="card-hard !p-1.5 px-2.5 text-[10px] mono uppercase hover:bg-[var(--color-pink)] hover:text-white inline-flex items-center gap-1"
                        >
                          <Star className="w-3 h-3" /> set default
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${r.title}"?`)) del.mutate(r.id);
                        }}
                        className="card-hard !p-1.5 px-2.5 text-[10px] mono uppercase hover:bg-[var(--color-ink)] hover:text-white inline-flex items-center gap-1 ml-auto"
                      >
                        <Trash2 className="w-3 h-3" /> delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Side */}
      <div className="col-span-12 lg:col-span-3 space-y-5">
        <Card>
          <h3 className="font-black text-lg mb-2">statistics</h3>
          <DashedDivider />
          <div className="space-y-3 mt-3">
            <div>
              <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)]">on file</div>
              <div className="font-black text-3xl">{total}</div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)]">default</div>
              <div className="font-bold text-sm">★ {defaultResume?.title ?? "—"}</div>
            </div>
            <div>
              <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)]">total submissions</div>
              <div className="font-black text-2xl">
                {resumes.data?.reduce((a, r) => a + r.usedCount, 0) ?? 0}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="font-black text-lg mb-2">storage</h3>
          <DashedDivider />
          <div className="space-y-2 mt-3">
            <div>
              <div className="mono text-[10px] uppercase text-[var(--color-ink-mute)]">location</div>
              <div className="mono text-xs">~/.internpilot/resumes</div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="font-black text-lg mb-2">how it works</h3>
          <DashedDivider />
          <p className="text-xs leading-relaxed mt-3">
            Pick one as <span className="text-[var(--color-pink)] font-bold">default</span>.
            That's the one we associate when you mark a job as applied. To rename, click
            the title and type. To delete, click ✕.
          </p>
        </Card>
      </div>
    </div>
  );
}
