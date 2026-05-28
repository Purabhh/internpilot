import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { createManualJob } from "@/lib/db/queries/jobs";
import {
  createApplication,
  createApplicationFromJob,
  listApplications,
  updateApplication,
  deleteApplication,
} from "@/lib/db/queries/applications";

describe("applications queries", () => {
  it("createApplicationFromJob copies job fields and starts as 'applied'", () => {
    const db = freshDb();
    const j = createManualJob(db, {
      source: "manual", sourceId: "1", company: "Citadel", role: "QR", location: "NY", url: "u", postedAt: null,
    });
    const a = createApplicationFromJob(db, j);
    expect(a.company).toBe("Citadel");
    expect(a.status).toBe("applied");
    expect(a.jobId).toBe(j.id);
  });

  it("createApplication creates a manual entry without a job_id", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "X", role: "R", location: null, url: null });
    expect(a.jobId).toBeNull();
    expect(a.status).toBe("applied");
  });

  it("listApplications can filter by status", () => {
    const db = freshDb();
    createApplication(db, { company: "A", role: "R" });
    const b = createApplication(db, { company: "B", role: "R" });
    updateApplication(db, b.id, { status: "rejected" });
    const open = listApplications(db, { status: "applied" });
    expect(open).toHaveLength(1);
    expect(open[0]?.company).toBe("A");
  });

  it("updateApplication patches status, notes, lastEmailAt", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "A", role: "R" });
    const updated = updateApplication(db, a.id, { status: "screen", notes: "OA · Thu", lastEmailAt: 123 });
    expect(updated?.status).toBe("screen");
    expect(updated?.notes).toBe("OA · Thu");
    expect(updated?.lastEmailAt).toBe(123);
  });

  it("deleteApplication returns the deleted row", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "A", role: "R" });
    const d = deleteApplication(db, a.id);
    expect(d?.id).toBe(a.id);
    expect(listApplications(db)).toHaveLength(0);
  });
});
