import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { correctEmail, getEmail } from "@/lib/db/queries/emails";
import { updateApplication, getApplication } from "@/lib/db/queries/applications";
import type { Status } from "@/lib/db/schema";

const patchSchema = z.object({
  classifiedStatus: z.enum(["applied", "screen", "interview", "offer", "rejected"]).optional(),
  classifiedCompany: z.string().optional(),
  applicationId: z.number().int().positive().nullable().optional(),
  applyToApplication: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = openDb(dbPath());
  const before = getEmail(db, id);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = correctEmail(db, id, {
    classifiedStatus: parsed.data.classifiedStatus,
    classifiedCompany: parsed.data.classifiedCompany,
    applicationId: parsed.data.applicationId,
  });

  if (parsed.data.applyToApplication && updated?.applicationId && updated.classifiedStatus) {
    const app = getApplication(db, updated.applicationId);
    if (app) updateApplication(db, app.id, { status: updated.classifiedStatus as Status, lastEmailAt: updated.receivedAt });
  }

  return NextResponse.json(updated);
}
