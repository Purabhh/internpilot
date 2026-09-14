import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { getSettings, updateSettings } from "@/lib/db/queries/settings";

describe("settings queries", () => {
  it("returns the singleton settings row", () => {
    const db = freshDb();
    const s = getSettings(db);
    expect(s.scraperEnabled).toBe(0);
    expect(s.trackerEnabled).toBe(0);
    expect(s.scraperIntervalMin).toBe(60);
    expect(s.trackerIntervalMin).toBe(3);
  });

  it("updates fields and returns the new row", () => {
    const db = freshDb();
    const updated = updateSettings(db, { scraperEnabled: 1, scraperIntervalMin: 30 });
    expect(updated.scraperEnabled).toBe(1);
    expect(updated.scraperIntervalMin).toBe(30);
    expect(updated.trackerEnabled).toBe(0);
  });

  it("ignores unknown fields silently", () => {
    const db = freshDb();
    updateSettings(db, { unknown: "x" } as never);
    const s = getSettings(db);
    expect(s).toBeDefined();
  });
});

import { GET, PATCH } from "@/app/api/settings/route";

describe("settings API route", () => {
  it("PATCH validates field ranges", async () => {
    const res = await PATCH(new Request("http://t/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ scraperIntervalMin: 99999 }),
    }));
    expect(res.status).toBe(400);
  });
});
