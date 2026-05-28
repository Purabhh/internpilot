import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { saveResumeFile, deleteResumeFile } from "@/lib/db/queries/resumes-fs";

const TMP = path.join(process.cwd(), ".test-resumes");

beforeEach(() => mkdirSync(TMP, { recursive: true }));
afterEach(() => rmSync(TMP, { recursive: true, force: true }));

describe("resume fs helpers", () => {
  it("saves a buffer with a unique filename", async () => {
    const buf = Buffer.from("PDFDATA");
    const result = await saveResumeFile(TMP, "resume.pdf", buf);
    expect(result.path.startsWith(TMP)).toBe(true);
    expect(existsSync(result.path)).toBe(true);
    expect(readFileSync(result.path).toString()).toBe("PDFDATA");
    expect(result.relativePath).toMatch(/^resumes\//);
  });

  it("does not collide on identical original filenames", async () => {
    const a = await saveResumeFile(TMP, "r.pdf", Buffer.from("a"));
    const b = await saveResumeFile(TMP, "r.pdf", Buffer.from("b"));
    expect(a.path).not.toBe(b.path);
  });

  it("deleteResumeFile removes the file", async () => {
    const r = await saveResumeFile(TMP, "r.pdf", Buffer.from("x"));
    deleteResumeFile(r.path);
    expect(existsSync(r.path)).toBe(false);
  });

  it("deleteResumeFile is idempotent", () => {
    expect(() => deleteResumeFile(path.join(TMP, "missing.pdf"))).not.toThrow();
  });
});
