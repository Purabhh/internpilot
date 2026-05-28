import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { createApplication, updateApplication } from "@/lib/db/queries/applications";
import { createManualJob } from "@/lib/db/queries/jobs";
import { getOverview } from "@/lib/db/queries/overview";

describe("overview", () => {
  it("counts applications by status", () => {
    const db = freshDb();
    createApplication(db, { company: "A", role: "R" });
    const b = createApplication(db, { company: "B", role: "R" });
    updateApplication(db, b.id, { status: "rejected" });
    const o = getOverview(db);
    expect(o.statusCounts.applied).toBe(1);
    expect(o.statusCounts.rejected).toBe(1);
  });

  it("counts jobs total and undismissed", () => {
    const db = freshDb();
    createManualJob(db, { source: "manual", sourceId: "1", company: "A", role: "R", location: null, url: "u", postedAt: null });
    const o = getOverview(db);
    expect(o.jobsTotal).toBe(1);
    expect(o.jobsOpen).toBe(1);
  });
});
