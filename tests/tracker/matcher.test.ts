import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { createApplication } from "@/lib/db/queries/applications";
import { matchEmailToApplication, normalizeCompany } from "@/lib/tracker/matcher";

describe("normalizeCompany", () => {
  it("lowercases and strips legal suffixes", () => {
    expect(normalizeCompany("Citadel Securities, Inc.")).toBe("citadel");
    expect(normalizeCompany("DRW LLC")).toBe("drw");
    expect(normalizeCompany("Jane Street Capital")).toBe("jane street");
  });

  it("collapses whitespace", () => {
    expect(normalizeCompany("  Two   Sigma   ")).toBe("two sigma");
  });
});

describe("matchEmailToApplication", () => {
  it("matches exact normalized company name", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "Citadel", role: "R" });
    const m = matchEmailToApplication(db, "Citadel", null);
    expect(m?.id).toBe(a.id);
  });

  it("matches even with Inc/LLC suffix differences", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "DRW", role: "R" });
    const m = matchEmailToApplication(db, "DRW LLC", null);
    expect(m?.id).toBe(a.id);
  });

  it("returns most recent when multiple apps at same company", async () => {
    const db = freshDb();
    createApplication(db, { company: "Optiver", role: "Trader" });
    await new Promise((r) => setTimeout(r, 10));
    const fresh = createApplication(db, { company: "Optiver", role: "SWE" });
    const m = matchEmailToApplication(db, "Optiver", null);
    expect(m?.id).toBe(fresh.id);
  });

  it("returns null when no company match", () => {
    const db = freshDb();
    createApplication(db, { company: "X", role: "R" });
    expect(matchEmailToApplication(db, "Y", null)).toBeNull();
  });

  it("returns null when input company is null", () => {
    const db = freshDb();
    createApplication(db, { company: "X", role: "R" });
    expect(matchEmailToApplication(db, null, null)).toBeNull();
  });
});
