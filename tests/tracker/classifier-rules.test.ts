import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { classifyByRules } from "@/lib/tracker/classifier-rules";

function load(name: string) {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), `tests/fixtures/emails/${name}.json`), "utf-8"),
  );
}

describe("classifyByRules", () => {
  it("flags rejection template", () => {
    const r = classifyByRules(load("rejection"));
    expect(r.status).toBe("rejected");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("flags HackerRank as OA → screen", () => {
    const r = classifyByRules(load("oa-invite"));
    expect(r.status).toBe("screen");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("flags Calendly link as interview", () => {
    const r = classifyByRules(load("calendly"));
    expect(r.status).toBe("interview");
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it("returns null for ambiguous recruiter chatter", () => {
    const r = classifyByRules(load("ambiguous"));
    expect(r.status).toBeNull();
  });
});
