import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { sources, type Source } from "@/lib/db/schema";

export function listSources(db: DB): Source[] {
  return db.select().from(sources).all();
}

export function setSourceEnabled(db: DB, name: string, enabled: boolean): Source | null {
  const existing = db.select().from(sources).where(eq(sources.name, name)).get();
  if (!existing) return null;
  db.update(sources).set({ enabled: enabled ? 1 : 0 }).where(eq(sources.name, name)).run();
  return db.select().from(sources).where(eq(sources.name, name)).get() ?? null;
}
