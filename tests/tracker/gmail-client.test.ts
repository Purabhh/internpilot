import { describe, it, expect, afterEach } from "vitest";
import { rmSync } from "node:fs";
import path from "node:path";
import { writeToken, readToken, parseReceivedAt, isStaleHistoryError } from "@/lib/tracker/gmail-client";

const tmp = path.join(process.cwd(), ".test-gmail");

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("gmail token io", () => {
  it("readToken returns null when file missing", () => {
    expect(readToken(path.join(tmp, "x.json"))).toBeNull();
  });

  it("writeToken then readToken roundtrip", () => {
    const tokenPath = path.join(tmp, "token.json");
    writeToken(tokenPath, { access_token: "a", refresh_token: "r", expiry_date: 1 });
    const got = readToken(tokenPath);
    expect(got?.access_token).toBe("a");
  });
});

describe("parseReceivedAt (EDGE 5)", () => {
  const NOW = 1_700_000_000;

  it("parses a valid RFC-2822 Date header to unix seconds", () => {
    const got = parseReceivedAt("Wed, 03 Jun 2026 10:00:00 -0700", NOW);
    expect(got).toBe(Math.floor(new Date("Wed, 03 Jun 2026 10:00:00 -0700").getTime() / 1000));
  });

  it("falls back to now for a missing header", () => {
    expect(parseReceivedAt(null, NOW)).toBe(NOW);
    expect(parseReceivedAt("", NOW)).toBe(NOW);
  });

  it("falls back to now for an unparseable header (never NaN)", () => {
    const got = parseReceivedAt("not a date", NOW);
    expect(got).toBe(NOW);
    expect(Number.isNaN(got)).toBe(false);
  });
});

describe("isStaleHistoryError (EDGE 4)", () => {
  it("is true for 404/410 (history expired)", () => {
    expect(isStaleHistoryError({ code: 404 })).toBe(true);
    expect(isStaleHistoryError({ code: 410 })).toBe(true);
    expect(isStaleHistoryError({ response: { status: 404 } })).toBe(true);
  });

  it("is false for transient errors that must NOT trigger a re-baseline", () => {
    expect(isStaleHistoryError({ code: 500 })).toBe(false);
    expect(isStaleHistoryError({ code: 429 })).toBe(false);
    expect(isStaleHistoryError(new Error("ECONNRESET"))).toBe(false);
    expect(isStaleHistoryError(null)).toBe(false);
  });
});
