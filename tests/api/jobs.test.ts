import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { listJobs, dismissJob, createManualJob } from "@/lib/db/queries/jobs";

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
});
