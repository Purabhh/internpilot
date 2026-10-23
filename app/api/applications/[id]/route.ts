import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { updateApplication, deleteApplication, getApplication } from "@/lib/db/queries/applications";

const patchSchema = z.object({
  status: z.enum(["saved", "applied", "screen", "interview", "offer", "rejected"]).optional(),
  notes: z.string().nullable().optional(),
  resumeId: z.number().int().positive().nullable().optional(),
  company: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  priority: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = openDb(dbPath());
  if (!getApplication(db, id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(updateApplication(db, id, parsed.data));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  const db = openDb(dbPath());
  const deleted = deleteApplication(db, id);
  if (!deleted) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
