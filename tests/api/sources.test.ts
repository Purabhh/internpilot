import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { listSources, setSourceEnabled } from "@/lib/db/queries/sources";

describe("sources queries", () => {
  it("listSources returns seeded sources", () => {
    const db = freshDb();
    expect(listSources(db).length).toBeGreaterThanOrEqual(4);
  });

  it("setSourceEnabled toggles by name", () => {
    const db = freshDb();
    const updated = setSourceEnabled(db, "simplify_newgrad", false);
    expect(updated?.enabled).toBe(0);
    const back = setSourceEnabled(db, "simplify_newgrad", true);
    expect(back?.enabled).toBe(1);
  });

  it("setSourceEnabled returns null for unknown name", () => {
    const db = freshDb();
    expect(setSourceEnabled(db, "nope", true)).toBeNull();
  });
});
