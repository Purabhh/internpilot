import { describe, it, expect, afterEach } from "vitest";
import { rmSync } from "node:fs";
import path from "node:path";
import { writeToken, readToken } from "@/lib/tracker/gmail-client";

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
