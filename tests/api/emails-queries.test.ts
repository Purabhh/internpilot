import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { insertEmailIfNew, listEmails, countEmails } from "@/lib/db/queries/emails";

function seed(db: ReturnType<typeof freshDb>, n: number) {
  // receivedAt ascending with id; listEmails orders by receivedAt desc, so the
  // newest (highest receivedAt) comes first.
  for (let i = 0; i < n; i++) {
    insertEmailIfNew(db, {
      gmailMsgId: `m${i}`,
      receivedAt: 1000 + i,
      needsReview: i % 2, // half need review
    });
  }
}

describe("listEmails pagination", () => {
  it("returns a page of `limit` rows starting at `offset`, newest first", () => {
    const db = freshDb();
    seed(db, 120);
    const page0 = listEmails(db, { limit: 50, offset: 0 });
    const page1 = listEmails(db, { limit: 50, offset: 50 });
    const page2 = listEmails(db, { limit: 50, offset: 100 });
    expect(page0).toHaveLength(50);
    expect(page1).toHaveLength(50);
    expect(page2).toHaveLength(20);
    // Newest first: page 0 starts at the highest receivedAt (m119).
    expect(page0[0]?.gmailMsgId).toBe("m119");
    // No overlap between consecutive pages.
    expect(page0.at(-1)?.gmailMsgId).toBe("m70");
    expect(page1[0]?.gmailMsgId).toBe("m69");
  });

  it("defaults to 50 rows when no limit is given", () => {
    const db = freshDb();
    seed(db, 60);
    expect(listEmails(db)).toHaveLength(50);
  });
});

describe("countEmails", () => {
  it("returns total and needs-review counts", () => {
    const db = freshDb();
    seed(db, 10); // 5 with needsReview=1 (odd indices)
    const c = countEmails(db);
    expect(c.total).toBe(10);
    expect(c.needsReview).toBe(5);
  });

  it("returns zeros for an empty table", () => {
    const db = freshDb();
    expect(countEmails(db)).toEqual({ total: 0, needsReview: 0 });
  });
});
