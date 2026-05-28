import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { startSchedulers, stopSchedulers } from "@/lib/jobs/scheduler";

describe("boot smoke", () => {
  it("startSchedulers + stopSchedulers without crash", () => {
    const db = freshDb();
    expect(() => startSchedulers(db)).not.toThrow();
    expect(() => stopSchedulers()).not.toThrow();
  });
});
