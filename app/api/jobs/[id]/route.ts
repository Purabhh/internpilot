import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { getJob, dismissJob } from "@/lib/db/queries/jobs";
import { createApplicationFromJob } from "@/lib/db/queries/applications";

const patchSchema = z.object({
  action: z.enum(["applied", "save", "dismiss"]),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = openDb(dbPath());
  const job = getJob(db, id);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  // "applied" and "save" both move the job off the board and into the tracker;
  // they differ only in which column it lands in. Dismissing on save (not just
  // on apply) is what prevents a saved job from being applied/saved a second
  // time from the board and spawning a duplicate application row.
  if (parsed.data.action === "applied" || parsed.data.action === "save") {
    const app = createApplicationFromJob(db, job, parsed.data.action === "save" ? "saved" : "applied");
    dismissJob(db, id);
    return NextResponse.json({ job: { ...job, dismissedAt: Math.floor(Date.now() / 1000) }, application: app });
  }
  // dismiss
  dismissJob(db, id);
  return NextResponse.json({ ok: true });
}
