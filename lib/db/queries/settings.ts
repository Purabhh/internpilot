import { eq } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { settings, type Settings } from "@/lib/db/schema";

const UPDATABLE_KEYS = [
  "scraperEnabled",
  "trackerEnabled",
  "scraperIntervalMin",
  "trackerIntervalMin",
  "gmailConnectedAt",
  "gmailHistoryId",
  // Stamped only by the tracker job; the public PATCH endpoint zod schema
  // doesn't list these so they can't be set from outside.
  "trackerLastRunAt",
  "trackerLastInserted",
  "trackerLastError",
  // Enricher daemon. enrichEnabled/enrichIntervalMin are user-settable via the
  // settings PATCH schema; the rest are stamped only by the enricher tick.
  "enrichEnabled",
  "enrichIntervalMin",
  "enrichLastRunAt",
  "enrichLastCount",
  "enrichLastError",
] as const;

type UpdatableKey = (typeof UPDATABLE_KEYS)[number];
export type SettingsUpdate = Partial<Pick<Settings, UpdatableKey>>;

export function getSettings(db: DB): Settings {
  const row = db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) throw new Error("settings row missing — db not initialized");
  return row;
}

export function updateSettings(db: DB, patch: SettingsUpdate): Settings {
  const filtered: Record<string, unknown> = {};
  for (const k of UPDATABLE_KEYS) {
    if (k in patch && patch[k] !== undefined) filtered[k] = patch[k];
  }
  if (Object.keys(filtered).length > 0) {
    db.update(settings).set(filtered).where(eq(settings.id, 1)).run();
  }
  return getSettings(db);
}
