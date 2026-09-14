import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { createApplication } from "@/lib/db/queries/applications";
import { upsertJobs } from "@/lib/db/queries/jobs";
import { listApplications } from "@/lib/db/queries/applications";
import { resolveApplicationForEmail } from "@/lib/tracker/resolve-application";

describe("resolveApplicationForEmail", () => {
  it("returns an existing application matched by company", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "Tesla", role: "SWE" });
    const got = resolveApplicationForEmail(db, { company: "Tesla", createIfMissing: false });
    expect(got?.id).toBe(a.id);
  });

  it("returns null when no match and createIfMissing is false", () => {
    const db = freshDb();
    expect(resolveApplicationForEmail(db, { company: "Tesla", createIfMissing: false })).toBeNull();
  });

  it("creates a standalone application when none exists and no job matches", () => {
    const db = freshDb();
    const got = resolveApplicationForEmail(db, { company: "Tesla", createIfMissing: true });
    expect(got).not.toBeNull();
    expect(got!.company).toBe("Tesla");
    expect(got!.role).toBe("(unknown role)");
    expect(got!.jobId).toBeNull();
    expect(listApplications(db)).toHaveLength(1);
  });

  it("creates an application linked to a Job when the email text matches a posting", () => {
    const db = freshDb();
    upsertJobs(db, "src", [
      { sourceId: "t1", company: "Tesla", role: "Software Engineer Intern, Service Engineering",
        location: "Palo Alto, CA", url: "https://tesla.com/careers/123", postedAt: null, terms: null },
    ]);
    const got = resolveApplicationForEmail(db, {
      company: "Tesla",
      emailText: "We received your application for Software Engineer Intern, Service Engineering.",
      createIfMissing: true,
    });
    expect(got!.jobId).not.toBeNull();
    expect(got!.role).toBe("Software Engineer Intern, Service Engineering");
  });

  it("does not create a duplicate when an application already exists", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "Tesla", role: "SWE" });
    const got = resolveApplicationForEmail(db, { company: "Tesla", createIfMissing: true });
    expect(got?.id).toBe(a.id);
    expect(listApplications(db)).toHaveLength(1);
  });

  it("returns null for a null company", () => {
    const db = freshDb();
    expect(resolveApplicationForEmail(db, { company: null, createIfMissing: true })).toBeNull();
    expect(listApplications(db)).toHaveLength(0);
  });
});
