import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { fakeAnthropic } from "@/tests/helpers/mock-anthropic";
import { createApplication, createApplicationFromJob, deleteApplication } from "@/lib/db/queries/applications";
import { upsertJobs, listJobs } from "@/lib/db/queries/jobs";
import { processEmails } from "@/lib/tracker/pipeline";
import { emails, applications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("processEmails", () => {
  it("rule-classified rejection updates the matched application", async () => {
    const db = freshDb();
    const a = createApplication(db, { company: "Citadel", role: "QR" });
    const llm = fakeAnthropic({});
    await processEmails(db, llm, [
      {
        gmailMsgId: "m1",
        threadId: "t1",
        from: "noreply@greenhouse.io",
        subject: "An update on your application to Citadel",
        snippet: "Unfortunately we won't be moving forward.",
        receivedAt: 1000,
      },
    ]);
    const updated = db.select().from(applications).where(eq(applications.id, a.id)).get();
    expect(updated?.status).toBe("rejected");
    expect(updated?.lastEmailAt).toBe(1000);
    const emailRows = db.select().from(emails).all();
    expect(emailRows[0]?.classifier).toBe("rules");
    expect(emailRows[0]?.applicationId).toBe(a.id);
  });

  it("uses LLM when rules find nothing", async () => {
    const db = freshDb();
    const a = createApplication(db, { company: "DRW", role: "Trader" });
    const llm = fakeAnthropic({ company: "DRW", status: "interview", confidence: 0.9, reasoning: "rec call" });
    await processEmails(db, llm, [
      {
        gmailMsgId: "m2", threadId: null,
        from: "talent@drw.com", subject: "chat?", snippet: "do you have time?",
        receivedAt: 2000,
      },
    ]);
    const updated = db.select().from(applications).where(eq(applications.id, a.id)).get();
    expect(updated?.status).toBe("interview");
    const e = db.select().from(emails).all()[0];
    expect(e?.classifier).toBe("llm");
  });

  it("stores email with needs_review when no matching application", async () => {
    const db = freshDb();
    const llm = fakeAnthropic({ company: "Unknown Co", status: "rejected", confidence: 0.9, reasoning: "" });
    await processEmails(db, llm, [
      {
        gmailMsgId: "m3", threadId: null,
        from: "x@x", subject: "thanks", snippet: "no thanks",
        receivedAt: 3000,
      },
    ]);
    const e = db.select().from(emails).all()[0];
    expect(e?.needsReview).toBe(1);
    expect(e?.applicationId).toBeNull();
  });

  it("low-confidence LLM result does not update application", async () => {
    const db = freshDb();
    const a = createApplication(db, { company: "X", role: "R" });
    const llm = fakeAnthropic({ company: "X", status: "rejected", confidence: 0.4, reasoning: "" });
    await processEmails(db, llm, [
      { gmailMsgId: "m4", threadId: null, from: "x", subject: "?", snippet: "?", receivedAt: 4000 },
    ]);
    const updated = db.select().from(applications).where(eq(applications.id, a.id)).get();
    expect(updated?.status).toBe("applied");
    const e = db.select().from(emails).all()[0];
    expect(e?.needsReview).toBe(1);
  });

  it("auto-creates an application linked to a Job when 'thank you for applying' email arrives", async () => {
    const db = freshDb();
    upsertJobs(db, "src", [
      { sourceId: "tt1", company: "TikTok", role: "Software Engineer Intern", location: "NYC",
        url: "https://careers.tiktok.com/job/abc", postedAt: null, terms: null },
    ]);
    const llm = fakeAnthropic({});
    await processEmails(db, llm, [
      {
        gmailMsgId: "m_apply", threadId: null,
        from: "noreply@tiktok.com",
        subject: "Thank you for applying to TikTok",
        snippet: "We've received your application for the Software Engineer Intern position.",
        receivedAt: 4242,
      },
    ]);
    const apps = db.select().from(applications).all();
    expect(apps).toHaveLength(1);
    expect(apps[0]?.company).toBe("TikTok");
    expect(apps[0]?.status).toBe("applied");
    expect(apps[0]?.jobId).not.toBeNull();
    expect(apps[0]?.lastEmailAt).toBe(4242);
    const e = db.select().from(emails).all()[0];
    expect(e?.applicationId).toBe(apps[0]?.id);
    expect(e?.needsReview).toBe(0);
  });

  it("auto-creates an application without jobId when no Job matches", async () => {
    const db = freshDb();
    // No jobs at this company in the DB — user applied via a referral / LinkedIn.
    const llm = fakeAnthropic({});
    await processEmails(db, llm, [
      {
        gmailMsgId: "m_apply_orphan", threadId: null,
        from: "talent@somecompany.com",
        subject: "Thank you for applying to SomeCompany",
        snippet: "We have received your application.",
        receivedAt: 5050,
      },
    ]);
    const apps = db.select().from(applications).all();
    expect(apps).toHaveLength(1);
    expect(apps[0]?.status).toBe("applied");
    expect(apps[0]?.jobId).toBeNull();
    expect(apps[0]?.company).toBe("SomeCompany");
  });

  it("does NOT auto-create on rejection — only existing apps get status updates", async () => {
    const db = freshDb();
    // No prior application, no jobs. A "rejection" arrives orphaned.
    const llm = fakeAnthropic({});
    await processEmails(db, llm, [
      {
        gmailMsgId: "m_orphan_rej", threadId: null,
        from: "noreply@x.com",
        subject: "Update on your application to GhostCo",
        snippet: "Unfortunately we won't be moving forward.",
        receivedAt: 6060,
      },
    ]);
    expect(db.select().from(applications).all()).toHaveLength(0);
    const e = db.select().from(emails).all()[0];
    expect(e?.needsReview).toBe(1);
  });

  it("runs rule-only when anthropic is null — rule-matched email still classifies", async () => {
    const db = freshDb();
    await processEmails(db, null, [
      {
        gmailMsgId: "m_rule_only", threadId: null,
        from: "noreply@x.com",
        subject: "Thank you for applying to RuleCo",
        snippet: "We received your application.",
        receivedAt: 7070,
      },
    ]);
    const apps = db.select().from(applications).all();
    expect(apps).toHaveLength(1);
    expect(apps[0]?.status).toBe("applied");
    const e = db.select().from(emails).all()[0];
    expect(e?.classifier).toBe("rules");
  });

  it("runs rule-only when anthropic is null — non-rule email lands in needs_review", async () => {
    const db = freshDb();
    await processEmails(db, null, [
      {
        gmailMsgId: "m_ambig", threadId: null,
        from: "recruiter@vague.com",
        subject: "Quick chat?",
        snippet: "Do you have time to talk this week?",
        receivedAt: 7171,
      },
    ]);
    expect(db.select().from(applications).all()).toHaveLength(0);
    const e = db.select().from(emails).all()[0];
    expect(e?.needsReview).toBe(1);
    expect(e?.classifier).toBe("needs_review");
  });

  it("skips messages already seen (gmail_msg_id unique)", async () => {
    const db = freshDb();
    const llm = fakeAnthropic({});
    const msg = {
      gmailMsgId: "dup", threadId: null,
      from: "x", subject: "y", snippet: "z", receivedAt: 5000,
    };
    await processEmails(db, llm, [msg]);
    await processEmails(db, llm, [msg]);
    expect(db.select().from(emails).all()).toHaveLength(1);
  });

  it("EDGE 1: replaying an applied email does NOT create duplicate applications", async () => {
    const db = freshDb();
    const llm = fakeAnthropic({});
    const msg = {
      gmailMsgId: "replay1", threadId: null,
      from: "Tesla <noreply@tesla.com>",
      subject: "Thank you for applying to Tesla",
      snippet: "We received your application.",
      receivedAt: 8000,
    };
    // The re-baseline path re-sees the same message every tick. Resolve/create
    // must run only for genuinely-new emails (insert is the idempotency gate).
    await processEmails(db, llm, [msg]);
    await processEmails(db, llm, [msg]);
    await processEmails(db, llm, [msg]);
    expect(db.select().from(applications).all()).toHaveLength(1);
    expect(db.select().from(emails).all()).toHaveLength(1);
  });

  it("EDGE 1: replaying an applied email after its app was deleted does NOT resurrect it", async () => {
    const db = freshDb();
    const llm = fakeAnthropic({});
    const msg = {
      gmailMsgId: "replay2", threadId: null,
      from: "Tesla <noreply@tesla.com>",
      subject: "Thank you for applying to Tesla",
      snippet: "We received your application.",
      receivedAt: 8100,
    };
    await processEmails(db, llm, [msg]);
    const created = db.select().from(applications).all();
    expect(created).toHaveLength(1);
    // deleteApplication detaches linked emails first (the real UI path).
    deleteApplication(db, created[0]!.id);
    // Replaying must not spawn a phantom because the email is already stored.
    await processEmails(db, llm, [msg]);
    expect(db.select().from(applications).all()).toHaveLength(0);
  });

  it("SAVED: a confirmation email flips a saved job to applied — no duplicate created", async () => {
    const db = freshDb();
    upsertJobs(db, "src", [
      { sourceId: "s1", company: "Stripe", role: "Software Engineer Intern", location: "NYC",
        url: "https://stripe.com/jobs/1", postedAt: null, terms: null },
    ]);
    const job = listJobs(db)[0]!;
    // Bookmarked from the board: lands in the tracker's Saved column.
    const saved = createApplicationFromJob(db, job, "saved");
    expect(saved.status).toBe("saved");

    // Later the user actually applies and the confirmation lands in Gmail.
    await processEmails(db, fakeAnthropic({}), [
      {
        gmailMsgId: "m_saved_apply", threadId: null,
        from: "Stripe <no-reply@stripe.com>",
        subject: "Thank you for applying to Stripe",
        snippet: "We received your application for the Software Engineer Intern position.",
        receivedAt: 9000,
      },
    ]);

    // The SAME row advanced (matched by company), rather than a second one spawning.
    const apps = db.select().from(applications).all();
    expect(apps).toHaveLength(1);
    expect(apps[0]?.id).toBe(saved.id);
    expect(apps[0]?.status).toBe("applied");
    expect(apps[0]?.lastEmailAt).toBe(9000);
    const e = db.select().from(emails).all()[0];
    expect(e?.applicationId).toBe(saved.id);
    expect(e?.needsReview).toBe(0);
  });

  it("EDGE 2: an older email does not regress a newer status", async () => {
    const db = freshDb();
    const a = createApplication(db, { company: "DRW", role: "Trader" });
    // Newer interview email lands first → status interview, lastEmailAt 5000.
    const interview = fakeAnthropic({ company: "DRW", status: "interview", confidence: 0.9, reasoning: "" });
    await processEmails(db, interview, [
      { gmailMsgId: "newer", threadId: null, from: "talent@drw.com", subject: "chat", snippet: "calendly", receivedAt: 5000 },
    ]);
    expect(db.select().from(applications).where(eq(applications.id, a.id)).get()?.status).toBe("interview");
    // Older applied confirmation processed afterward must NOT pull it back.
    const applied = fakeAnthropic({ company: "DRW", status: "applied", confidence: 0.9, reasoning: "" });
    await processEmails(db, applied, [
      { gmailMsgId: "older", threadId: null, from: "talent@drw.com", subject: "received", snippet: "thanks for applying", receivedAt: 3000 },
    ]);
    const after = db.select().from(applications).where(eq(applications.id, a.id)).get();
    expect(after?.status).toBe("interview");
    expect(after?.lastEmailAt).toBe(5000);
  });
});
