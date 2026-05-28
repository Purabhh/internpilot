import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DIR_NAME = ".internpilot";

export function dataDir(home: string = homedir()): string {
  return path.join(home, DIR_NAME);
}

export function dbPath(home?: string): string {
  return path.join(dataDir(home), "internpilot.db");
}

export function resumesDir(home?: string): string {
  return path.join(dataDir(home), "resumes");
}

export function credentialsPath(home?: string): string {
  return path.join(dataDir(home), "credentials.json");
}

export function gmailTokenPath(home?: string): string {
  return path.join(dataDir(home), "gmail_token.json");
}

export function ensureDataDirs(home?: string): void {
  mkdirSync(dataDir(home), { recursive: true });
  mkdirSync(resumesDir(home), { recursive: true });
}
