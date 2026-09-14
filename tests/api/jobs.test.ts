import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { listJobs, countJobs, dismissJob, createManualJob } from "@/lib/db/queries/jobs";

describe("jobs queries", () => {
  it("listJobs hides dismissed by default", () => {
    const db = freshDb();
    const a = createManualJob(db, {
      source: "manual", sourceId: "1", company: "A", role: "R", location: null, url: "u", postedAt: null,
    });
    dismissJob(db, a.id);
    expect(listJobs(db)).toHaveLength(0);
    expect(listJobs(db, { includeDismissed: true })).toHaveLength(1);
  });

  it("createManualJob creates with source='manual'", () => {
    const db = freshDb();
    const j = createManualJob(db, {
      source: "manual", sourceId: "x", company: "C", role: "R", location: null, url: "u", postedAt: null,
    });
    expect(j.source).toBe("manual");
  });

  it("search matches company, role, and location case-insensitively", () => {
    const db = freshDb();
    createManualJob(db, {
      source: "manual", sourceId: "1", company: "Snowflake", role: "SWE Intern", location: "Menlo Park, CA", url: "u1", postedAt: null,
    });
    createManualJob(db, {
      source: "manual", sourceId: "2", company: "Stripe", role: "Backend Intern", location: "NYC", url: "u2", postedAt: null,
    });
    expect(listJobs(db, { search: "snowflake" })).toHaveLength(1);
    expect(listJobs(db, { search: "backend" })).toHaveLength(1);
    expect(listJobs(db, { search: "nyc" })).toHaveLength(1);
    expect(listJobs(db, { search: "zzz-no-match" })).toHaveLength(0);
    expect(countJobs(db, { search: "intern" })).toBe(2);
  });

  it("US-only default excludes non-US locations but keeps null and US lookalikes", () => {
    const db = freshDb();
    createManualJob(db, {
      source: "manual", sourceId: "us1", company: "A", role: "R", location: "Milwaukee, WI", url: "u", postedAt: null,
    });
    createManualJob(db, {
      source: "manual", sourceId: "ca1", company: "B", role: "R", location: "Toronto, ON, Canada", url: "u", postedAt: null,
    });
    createManualJob(db, {
      source: "manual", sourceId: "uk1", company: "C", role: "R", location: "London, UK", url: "u", postedAt: null,
    });
    createManualJob(db, {
      source: "manual", sourceId: "n1", company: "D", role: "R", location: null, url: "u", postedAt: null,
    });
    const visible = listJobs(db);
    const companies = visible.map((j) => j.company).sort();
    // Milwaukee must not trip the "uk" substring; null location stays.
    expect(companies).toEqual(["A", "D"]);
    expect(listJobs(db, { includeNonUs: true })).toHaveLength(4);
  });
});
