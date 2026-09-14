import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { createManualJob, listJobs, listJobsToEnrich } from "@/lib/db/queries/jobs";
import { runEnricher } from "@/lib/enrich";

function fakeFetch(bodies: Record<string, string>): typeof fetch {
  return (async (url: string) => {
    const body = bodies[url];
    if (body === undefined) return { ok: false, status: 404, text: async () => "" } as unknown as Response;
    return { ok: true, status: 200, text: async () => body } as unknown as Response;
  }) as typeof fetch;
}

describe("runEnricher", () => {
  it("prices a batch, returns the found count, and won't re-enrich", async () => {
    const db = freshDb();
    createManualJob(db, { source: "manual", sourceId: "1", company: "Paid", role: "R", location: "NYC", url: "https://a/1", postedAt: null });
    createManualJob(db, { source: "manual", sourceId: "2", company: "Silent", role: "R", location: "NYC", url: "https://a/2", postedAt: null });
    createManualJob(db, { source: "manual", sourceId: "3", company: "Blocked", role: "R", location: "NYC", url: "https://a/3", postedAt: null });

    const httpFetch = fakeFetch({
      "https://a/1": "We pay $120,000 - $150,000 per year.",
      "https://a/2": "Great team, no pay listed here.",
      // https://a/3 → 404 (blocked page)
    });

    const found = await runEnricher(db, { httpFetch, concurrency: 2 });
    expect(found).toBe(1); // only "Paid" yielded a salary

    // Everything was attempted, so the queue is now empty.
    expect(listJobsToEnrich(db, 10)).toHaveLength(0);

    const paid = listJobs(db).find((j) => j.company === "Paid")!;
    expect(paid.salaryMin).toBe(120_000);
    expect(paid.salaryMax).toBe(150_000);

    const silent = listJobs(db).find((j) => j.company === "Silent")!;
    expect(silent.salaryMax).toBeNull();
    expect(silent.salaryEnrichedAt).not.toBeNull();

    // A second run has nothing to do.
    expect(await runEnricher(db, { httpFetch })).toBe(0);
  });
});
