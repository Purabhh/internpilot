import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { fakeAnthropic } from "@/tests/helpers/mock-anthropic";
import { createApplication } from "@/lib/db/queries/applications";
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
});
