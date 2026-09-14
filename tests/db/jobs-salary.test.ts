import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import {
  createManualJob,
  listJobs,
  countJobs,
  listJobsToEnrich,
  countJobsToEnrich,
  setJobSalary,
} from "@/lib/db/queries/jobs";

function job(db: ReturnType<typeof freshDb>, sourceId: string, company: string, location: string | null) {
  return createManualJob(db, {
    source: "manual", sourceId, company, role: "SWE", location, url: `https://x/${sourceId}`, postedAt: null,
  });
}

describe("min-salary filter", () => {
  it("keeps jobs at/above the threshold and drops below + N/A", () => {
    const db = freshDb();
    const low = job(db, "1", "Low", "NYC");
    const high = job(db, "2", "High", "NYC");
    job(db, "3", "Unpriced", "NYC"); // never enriched → N/A
    setJobSalary(db, low.id, { raw: "$90k", min: 90_000, max: 90_000 });
    setJobSalary(db, high.id, { raw: "$140k", min: 130_000, max: 140_000 });

    const got = listJobs(db, { minSalary: 100_000 });
    expect(got.map((j) => j.company)).toEqual(["High"]);
    // N/A + below-threshold both excluded from the count.
    expect(countJobs(db, { minSalary: 100_000 })).toBe(1);
  });

  it("matches on salaryMax (best case of the range)", () => {
    const db = freshDb();
    const j = job(db, "1", "Range", "NYC");
    setJobSalary(db, j.id, { raw: "$80k-$120k", min: 80_000, max: 120_000 });
    expect(listJobs(db, { minSalary: 120_000 })).toHaveLength(1);
    expect(listJobs(db, { minSalary: 121_000 })).toHaveLength(0);
  });

  it("does not affect results when no min-salary is set", () => {
    const db = freshDb();
    job(db, "1", "A", "NYC");
    job(db, "2", "B", "NYC");
    expect(listJobs(db)).toHaveLength(2);
  });
});

describe("location filters", () => {
  it("filters by market substring", () => {
    const db = freshDb();
    job(db, "1", "A", "New York, NY");
    job(db, "2", "B", "Austin, TX");
    expect(listJobs(db, { location: "new york" }).map((j) => j.company)).toEqual(["A"]);
  });

  it("filters by state code without tripping lookalikes", () => {
    const db = freshDb();
    job(db, "1", "A", "New York, NY");
    job(db, "2", "B", "Anytown, CA"); // must not match "NY" as a substring
    job(db, "3", "C", "Buffalo, NY; Remote");
    const got = listJobs(db, { state: "NY" }).map((j) => j.company).sort();
    expect(got).toEqual(["A", "C"]);
  });

  it("filters remote-only", () => {
    const db = freshDb();
    job(db, "1", "A", "Remote in USA");
    job(db, "2", "B", "New York, NY");
    expect(listJobs(db, { remoteOnly: true }).map((j) => j.company)).toEqual(["A"]);
  });
});

describe("enrichment queue helpers", () => {
  it("listJobsToEnrich returns only un-enriched, non-dismissed jobs", () => {
    const db = freshDb();
    const a = job(db, "1", "A", "NYC");
    const b = job(db, "2", "B", "NYC");
    expect(countJobsToEnrich(db)).toBe(2);
    setJobSalary(db, a.id, { raw: "$120k", min: 120_000, max: 120_000 });
    const queue = listJobsToEnrich(db, 10);
    expect(queue.map((j) => j.id)).toEqual([b.id]);
    expect(countJobsToEnrich(db)).toBe(1);
  });

  it("setJobSalary(null) marks attempted but leaves salary null (genuine N/A)", () => {
    const db = freshDb();
    const a = job(db, "1", "A", "NYC");
    setJobSalary(db, a.id, null);
    const [row] = listJobs(db);
    expect(row!.salaryMax).toBeNull();
    expect(row!.salaryEnrichedAt).not.toBeNull();
    // Attempted rows leave the queue so they're never re-fetched.
    expect(listJobsToEnrich(db, 10)).toHaveLength(0);
  });
});
