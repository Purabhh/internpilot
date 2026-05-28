import { NextResponse } from "next/server";
import { z } from "zod";
import path from "node:path";
import { openDb } from "@/lib/db/client";
import { dataDir, dbPath } from "@/lib/paths";
import { getResume, renameResume, setDefaultResume, deleteResume } from "@/lib/db/queries/resumes";
import { deleteResumeFile } from "@/lib/db/queries/resumes-fs";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  setDefault: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = openDb(dbPath());
  let row = getResume(db, id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (parsed.data.title !== undefined) row = renameResume(db, id, parsed.data.title);
  if (parsed.data.setDefault === true) row = setDefaultResume(db, id);
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  const db = openDb(dbPath());
  const deleted = deleteResume(db, id);
  if (!deleted) return NextResponse.json({ error: "not found" }, { status: 404 });
  deleteResumeFile(path.join(dataDir(), deleted.path));
  return NextResponse.json({ ok: true });
}
