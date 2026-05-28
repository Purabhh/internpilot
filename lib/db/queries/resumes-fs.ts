import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function saveResumeFile(
  root: string,
  originalName: string,
  buf: Buffer,
): Promise<{ path: string; relativePath: string }> {
  if (buf.byteLength > MAX_RESUME_BYTES) throw new Error("file too large");
  const subdir = path.join(root, "resumes");
  mkdirSync(subdir, { recursive: true });
  const ext = path.extname(originalName) || ".bin";
  const uniqueName = `${Date.now()}_${randomBytes(4).toString("hex")}${ext}`;
  const full = path.join(subdir, uniqueName);
  writeFileSync(full, buf);
  return { path: full, relativePath: `resumes/${uniqueName}` };
}

export function deleteResumeFile(absPath: string): void {
  if (existsSync(absPath)) unlinkSync(absPath);
}
