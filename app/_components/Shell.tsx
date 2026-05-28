"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/ui/fetcher";
import type { OverviewResponse } from "@/lib/ui/types";

const TABS: Array<{ href: string; label: string; countKey?: "jobsOpen" | "applied" | "resumes" | "emails" }> = [
  { href: "/overview", label: "overview" },
  { href: "/jobs", label: "jobs", countKey: "jobsOpen" },
  { href: "/tracker", label: "tracker", countKey: "applied" },
  { href: "/resumes", label: "resumes", countKey: "resumes" },
  { href: "/emails", label: "emails", countKey: "emails" },
];

function useNavCounts() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => fetchJson<OverviewResponse>("/api/overview"),
  });
  const resumes = useQuery({
    queryKey: ["resumes-count"],
    queryFn: () => fetchJson<unknown[]>("/api/resumes").then((r) => r.length),
  });
  const emails = useQuery({
    queryKey: ["emails-count"],
    queryFn: () => fetchJson<unknown[]>("/api/emails?limit=1000").then((r) => r.length),
  });
  return {
    jobsOpen: overview.data?.jobsOpen,
    applied:
      overview.data &&
      Object.values(overview.data.statusCounts).reduce((a, b) => a + b, 0),
    resumes: resumes.data,
    emails: emails.data,
  };
}

function TPlusTimer() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const elapsed = Math.floor((now - start) / 1000);
  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return <span className="mono text-sm tracking-wider">T+ {h}:{m}:{s}</span>;
}

function LivePill() {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchJson<{ scraperEnabled: number; trackerEnabled: number }>("/api/settings"),
    staleTime: 5_000,
  });
  const live = (settings.data?.scraperEnabled ?? 0) === 1 || (settings.data?.trackerEnabled ?? 0) === 1;
  if (live) {
    return (
      <span className="badge-mono badge-mono-blue inline-flex items-center gap-1.5">
        <span className="pulse-dot bg-white!" style={{ backgroundColor: "white" }} />
        live
      </span>
    );
  }
  return <span className="badge-mono">idle</span>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const counts = useNavCounts();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 pt-6 pb-4 flex items-center gap-8 sticky top-0 z-30 bg-[var(--color-cream)]/95 backdrop-blur">
        <Link href="/overview" className="flex items-center gap-2 font-black text-lg shrink-0">
          <span className="text-[var(--color-pink)] text-xl leading-none">★</span>
          <span>intern</span>
          <span className="text-[var(--color-ink-mute)]">·</span>
          <span>pilot</span>
        </Link>

        <nav className="pill-nav flex items-center gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href || (pathname === "/" && t.href === "/overview");
            const count =
              t.countKey === "jobsOpen" ? counts.jobsOpen :
              t.countKey === "applied" ? counts.applied :
              t.countKey === "resumes" ? counts.resumes :
              t.countKey === "emails" ? counts.emails : undefined;
            return (
              <Link key={t.href} href={t.href} className="pill-link" data-active={active}>
                {t.label}
                {typeof count === "number" && (
                  <span className="mono text-xs ml-1.5 opacity-70">{count}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <LivePill />
          <TPlusTimer />
        </div>
      </header>

      <main className="flex-1 px-8 pb-12">{children}</main>
    </div>
  );
}
