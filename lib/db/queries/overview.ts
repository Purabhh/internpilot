import { count, isNull } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { applications, jobs, type Status } from "@/lib/db/schema";

const STATUSES: Status[] = ["saved", "applied", "screen", "interview", "offer", "rejected"];

export interface Overview {
  statusCounts: Record<Status, number>;
  jobsTotal: number;
  jobsOpen: number;
}

export function getOverview(db: DB): Overview {
  const statusRows = db
    .select({ status: applications.status, n: count() })
    .from(applications)
    .groupBy(applications.status)
    .all();
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const r of statusRows) statusCounts[r.status as Status] = Number(r.n);

  const totalRow = db.select({ n: count() }).from(jobs).get();
  const openRow = db.select({ n: count() }).from(jobs).where(isNull(jobs.dismissedAt)).get();

  return {
    statusCounts,
    jobsTotal: Number(totalRow?.n ?? 0),
    jobsOpen: Number(openRow?.n ?? 0),
  };
}
