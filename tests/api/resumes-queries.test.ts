import { describe, it, expect } from "vitest";
import { freshDb } from "@/tests/helpers/test-db";
import {
  createResume,
  listResumes,
  setDefaultResume,
  renameResume,
  deleteResume,
} from "@/lib/db/queries/resumes";

describe("resume queries", () => {
  it("creates a resume and returns it", () => {
    const db = freshDb();
    const r = createResume(db, {
      title: "Quant default",
      filename: "sharma_quant_v7.docx",
      path: "resumes/abc.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(r.id).toBeGreaterThan(0);
    expect(r.title).toBe("Quant default");
    expect(r.isDefault).toBe(0);
    expect(r.usedCount).toBe(0);
  });

  it("listResumes sorts by uploaded_at desc", async () => {
    const db = freshDb();
    createResume(db, { title: "A", filename: "a.docx", path: "x", mimeType: "x" });
    await new Promise((r) => setTimeout(r, 10));
    createResume(db, { title: "B", filename: "b.docx", path: "x", mimeType: "x" });
    const rows = listResumes(db);
    expect(rows[0]?.title).toBe("B");
    expect(rows[1]?.title).toBe("A");
  });

  it("setDefaultResume clears previous default", () => {
    const db = freshDb();
    const a = createResume(db, { title: "A", filename: "a", path: "x", mimeType: "x" });
    const b = createResume(db, { title: "B", filename: "b", path: "x", mimeType: "x" });
    setDefaultResume(db, a.id);
    setDefaultResume(db, b.id);
    const rows = listResumes(db);
    expect(rows.find((r) => r.id === a.id)?.isDefault).toBe(0);
    expect(rows.find((r) => r.id === b.id)?.isDefault).toBe(1);
  });

  it("renameResume changes title only", () => {
    const db = freshDb();
    const a = createResume(db, { title: "A", filename: "a", path: "x", mimeType: "x" });
    const renamed = renameResume(db, a.id, "A2");
    expect(renamed?.title).toBe("A2");
    expect(renamed?.filename).toBe("a");
  });

  it("deleteResume returns the deleted row's path for caller cleanup", () => {
    const db = freshDb();
    const a = createResume(db, { title: "A", filename: "a", path: "resumes/a.docx", mimeType: "x" });
    const deleted = deleteResume(db, a.id);
    expect(deleted?.path).toBe("resumes/a.docx");
    expect(listResumes(db)).toHaveLength(0);
  });

  it("deleteResume returns null for non-existent id", () => {
    const db = freshDb();
    expect(deleteResume(db, 999)).toBeNull();
  });
});
