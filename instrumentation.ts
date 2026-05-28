export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDataDirs, dbPath } = await import("@/lib/paths");
  const { openDb } = await import("@/lib/db/client");
  const { startSchedulers } = await import("@/lib/jobs/scheduler");

  ensureDataDirs();
  const db = openDb(dbPath());
  startSchedulers(db);
  console.log("[internpilot] schedulers registered");
}
