import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { createManualJob } from "@/lib/db/queries/jobs";
import {
  createApplication,
  createApplicationFromJob,
  getApplicationByJobId,
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

  it("updateApplication edits company and role but ignores blank values", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "Tesla", role: "(unknown role)" });
    const updated = updateApplication(db, a.id, { company: "Tesla", role: "SWE Intern, Service" });
    expect(updated?.role).toBe("SWE Intern, Service");
    // A blank/whitespace value must not wipe the field (inline-edit blur guard).
    const after = updateApplication(db, a.id, { role: "   " });
    expect(after?.role).toBe("SWE Intern, Service");
  });

  it("getApplicationByJobId finds the app created from a job", () => {
    const db = freshDb();
    const j = createManualJob(db, {
      source: "manual", sourceId: "1", company: "Snowflake", role: "SWE Intern", location: null, url: "u", postedAt: null,
    });
    expect(getApplicationByJobId(db, j.id)).toBeNull();
    const a = createApplicationFromJob(db, j);
    expect(getApplicationByJobId(db, j.id)?.id).toBe(a.id);
  });

  it("deleteApplication returns the deleted row", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "A", role: "R" });
    const d = deleteApplication(db, a.id);
    expect(d?.id).toBe(a.id);
    expect(listApplications(db)).toHaveLength(0);
  });

  it("deleteApplication detaches linked emails instead of FK-failing", async () => {
    // Regression: emails.applicationId FK was RESTRICT, so deleting an app
    // that had a classified email attached threw "FOREIGN KEY constraint
    // failed" → 500. Now the email survives, its applicationId is nulled,
    // and needsReview is bumped back so the user can re-triage.
    const { emails: emailsTable } = await import("@/lib/db/schema");
    const db = freshDb();
    const a = createApplication(db, { company: "TikTok", role: "R" });
    db.insert(emailsTable).values({
      gmailMsgId: "m_attached",
      receivedAt: 1000,
      applicationId: a.id,
      needsReview: 0,
    }).run();

    const d = deleteApplication(db, a.id);
    expect(d?.id).toBe(a.id);
    expect(listApplications(db)).toHaveLength(0);

    const orphans = db.select().from(emailsTable).all();
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.applicationId).toBeNull();
    expect(orphans[0]?.needsReview).toBe(1);
  });

  it("starred applications sort first and status changes keep the star", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "A", role: "r" });
    const b = createApplication(db, { company: "B", role: "r" });
    expect(a.priority).toBe(0);
    updateApplication(db, a.id, { priority: true });
    expect(listApplications(db).map((x) => x.company)).toEqual(["A", "B"]);
    const moved = updateApplication(db, a.id, { status: "screen" });
    expect(moved?.priority).toBe(1);
    expect(updateApplication(db, a.id, { priority: false })?.priority).toBe(0);
    void b;
  });
});
