import { describe, it, expect, beforeEach } from "vitest";
import { homedir } from "node:os";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { dataDir, dbPath, resumesDir, ensureDataDirs } from "@/lib/paths";

describe("paths", () => {
  it("dataDir is under home directory", () => {
    expect(dataDir()).toBe(path.join(homedir(), ".internpilot"));
  });

  it("dbPath is inside dataDir", () => {
    expect(dbPath()).toBe(path.join(dataDir(), "internpilot.db"));
  });

  it("resumesDir is inside dataDir", () => {
    expect(resumesDir()).toBe(path.join(dataDir(), "resumes"));
  });

  it("ensureDataDirs creates all required directories", () => {
    const testHome = path.join(process.cwd(), ".test-home");
    rmSync(testHome, { recursive: true, force: true });
    ensureDataDirs(testHome);
    expect(existsSync(path.join(testHome, ".internpilot"))).toBe(true);
    expect(existsSync(path.join(testHome, ".internpilot", "resumes"))).toBe(true);
    rmSync(testHome, { recursive: true, force: true });
  });
});
