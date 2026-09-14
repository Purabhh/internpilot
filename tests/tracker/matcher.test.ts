import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { createApplication } from "@/lib/db/queries/applications";
import { upsertJobs } from "@/lib/db/queries/jobs";
import { matchEmailToApplication, matchEmailToJob, normalizeCompany } from "@/lib/tracker/matcher";

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

  it("substring-matches 'TikTok Early Careers' to existing 'TikTok'", () => {
    // Real bug: assessment email said "applying to TikTok Early Careers" so
    // extractCompany pulled "TikTok Early Careers" — exact match failed and a
    // duplicate app was created. Substring fallback should attach it to TikTok.
    const db = freshDb();
    const a = createApplication(db, { company: "TikTok", role: "SWE" });
    const m = matchEmailToApplication(db, "TikTok Early Careers", null);
    expect(m?.id).toBe(a.id);
  });

  it("substring-matches existing 'Goldman Sachs Securities' to classified 'Goldman'", () => {
    // Other direction: classified name is a substring of the existing company.
    const db = freshDb();
    const a = createApplication(db, { company: "Goldman Sachs Securities", role: "R" });
    const m = matchEmailToApplication(db, "Goldman", null);
    expect(m?.id).toBe(a.id);
  });

  it("falls back to sender-domain stem when classifiedCompany is null", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "TikTok", role: "R" });
    const m = matchEmailToApplication(db, null, "tiktok.com");
    expect(m?.id).toBe(a.id);
  });

  it("strips subdomains when matching by sender domain", () => {
    const db = freshDb();
    const a = createApplication(db, { company: "Greenhouse", role: "R" });
    const m = matchEmailToApplication(db, null, "noreply.greenhouse.io");
    expect(m?.id).toBe(a.id);
  });

  it("doesn't false-positive when neither company nor domain stem overlap", () => {
    const db = freshDb();
    createApplication(db, { company: "Stripe", role: "R" });
    expect(matchEmailToApplication(db, "Microsoft", "microsoft.com")).toBeNull();
  });
});

describe("matchEmailToJob", () => {
  it("picks the job whose URL appears in the email text", () => {
    const db = freshDb();
    upsertJobs(db, "src", [
      { sourceId: "1", company: "TikTok", role: "ML Engineer Intern", location: null,
        url: "https://careers.tiktok.com/job/111", postedAt: null, terms: null },
      { sourceId: "2", company: "TikTok", role: "Software Engineer Intern", location: null,
        url: "https://careers.tiktok.com/job/222", postedAt: null, terms: null },
    ]);
    const m = matchEmailToJob(db, "TikTok", "Thanks for applying! https://careers.tiktok.com/job/222 — we'll be in touch.");
    expect(m?.sourceId).toBe("2");
  });

  it("falls back to role-name match when no URL appears", () => {
    const db = freshDb();
    upsertJobs(db, "src", [
      { sourceId: "1", company: "TikTok", role: "ML Engineer Intern", location: null,
        url: "https://x/1", postedAt: null, terms: null },
      { sourceId: "2", company: "TikTok", role: "Software Engineer Intern", location: null,
        url: "https://x/2", postedAt: null, terms: null },
    ]);
    const m = matchEmailToJob(db, "TikTok", "Thank you for applying to the Software Engineer Intern position at TikTok!");
    expect(m?.sourceId).toBe("2");
  });

  it("returns null when company matches but neither URL nor role hits", () => {
    const db = freshDb();
    upsertJobs(db, "src", [
      { sourceId: "1", company: "TikTok", role: "Backend Engineer", location: null,
        url: "https://careers.tiktok.com/1", postedAt: null, terms: null },
    ]);
    const m = matchEmailToJob(db, "TikTok", "We received your application. We'll let you know.");
    expect(m).toBeNull();
  });

  it("returns null when no jobs exist for the company", () => {
    const db = freshDb();
    upsertJobs(db, "src", [
      { sourceId: "1", company: "Other Co", role: "R", location: null,
        url: "https://x", postedAt: null, terms: null },
    ]);
    const m = matchEmailToJob(db, "TikTok", "Thank you for applying.");
    expect(m).toBeNull();
  });

  it("returns null when classified company is null", () => {
    const db = freshDb();
    expect(matchEmailToJob(db, null, "anything")).toBeNull();
  });
});
