import { openDb, type DB } from "@/lib/db/client";

export function freshDb(): DB {
  return openDb(":memory:");
}
