import { describe, it, expect, vi } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import { updateSettings } from "@/lib/db/queries/settings";
import { tickScraper } from "@/lib/jobs/scraper-job";

describe("tickScraper", () => {
  it("does nothing when scraper disabled", async () => {
    const db = freshDb();
    const runMock = vi.fn();
    await tickScraper(db, runMock);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("runs when scraper enabled", async () => {
    const db = freshDb();
    updateSettings(db, { scraperEnabled: 1 });
    const runMock = vi.fn().mockResolvedValue(undefined);
    await tickScraper(db, runMock);
    expect(runMock).toHaveBeenCalledOnce();
  });

  it("swallows errors so cron does not crash", async () => {
    const db = freshDb();
    updateSettings(db, { scraperEnabled: 1 });
    const runMock = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(tickScraper(db, runMock)).resolves.toBeUndefined();
  });
});
