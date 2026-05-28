import { NextResponse } from "next/server";
import { openDb } from "@/lib/db/client";
import { dataDir, dbPath, ensureDataDirs } from "@/lib/paths";
import { listResumes, createResume } from "@/lib/db/queries/resumes";
import { saveResumeFile, ALLOWED_MIMES, MAX_RESUME_BYTES } from "@/lib/db/queries/resumes-fs";

export async function GET() {
  const db = openDb(dbPath());
  return NextResponse.json(listResumes(db));
}

export async function POST(req: Request) {
  ensureDataDirs();
  const form = await req.formData();
  const title = form.get("title");
  const file = form.get("file");
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: "only .docx or .pdf allowed" }, { status: 400 });
  }
  if (file.size > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "max 10MB" }, { status: 413 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveResumeFile(dataDir(), file.name, buf);
  const db = openDb(dbPath());
  const row = createResume(db, {
    title: title.trim(),
    filename: file.name,
    path: saved.relativePath,
    mimeType: file.type,
  });
  return NextResponse.json(row, { status: 201 });
}
