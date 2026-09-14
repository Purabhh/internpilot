import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db/client";
import { dbPath } from "@/lib/paths";
import { correctEmail, getEmail } from "@/lib/db/queries/emails";
import {
  updateApplication,
  getApplication,
  getApplicationByJobId,
  createApplicationFromJob,
} from "@/lib/db/queries/applications";
import { getJob } from "@/lib/db/queries/jobs";
import { parseSenderDomain } from "@/lib/tracker/matcher";
import { resolveApplicationForEmail } from "@/lib/tracker/resolve-application";
import type { Status } from "@/lib/db/schema";

const patchSchema = z.object({
  classifiedStatus: z.enum(["applied", "screen", "interview", "offer", "rejected"]).optional(),
  classifiedCompany: z.string().optional(),
  applicationId: z.number().int().positive().nullable().optional(),
  /** Link the email to this job posting — creates an application from it
   *  (real role/location/url) if one doesn't already exist for the job. */
  jobId: z.number().int().positive().nullable().optional(),
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

  let updated = correctEmail(db, id, {
    classifiedStatus: parsed.data.classifiedStatus,
    classifiedCompany: parsed.data.classifiedCompany,
    applicationId: parsed.data.applicationId,
  });

  // Apply the correction to an application. Precedence:
  //   1. jobId given      -> reuse the app for that job, or create one from it
  //                          (gives the real role / location / url)
  //   2. applicationId    -> the app the user picked from the dropdown
  //   3. company only     -> match an existing app, else create a standalone
  // A manual fix is the user asserting "this is my application", so we create
  // when nothing matches (previously this required a pre-existing applicationId,
  // so a fix with no matching app cleared needs-review but made no tracker card).
  if (parsed.data.applyToApplication && updated?.classifiedStatus) {
    const status = updated.classifiedStatus as Status;
    let app = null;

    if (parsed.data.jobId) {
      const job = getJob(db, parsed.data.jobId);
      if (job) app = getApplicationByJobId(db, job.id) ?? createApplicationFromJob(db, job);
    }
    if (!app && updated.applicationId) {
      app = getApplication(db, updated.applicationId);
    }
    if (!app) {
      app = resolveApplicationForEmail(db, {
        company: updated.classifiedCompany,
        senderDomain: parseSenderDomain(updated.fromAddr),
        emailText: `${updated.subject ?? ""} ${updated.snippet ?? ""}`,
        createIfMissing: true,
      });
    }

    if (app) {
      // Link the email to the resolved/created application, then advance status.
      if (updated.applicationId !== app.id) updated = correctEmail(db, id, { applicationId: app.id });
      updateApplication(db, app.id, { status, lastEmailAt: updated!.receivedAt });
    }
  }

  return NextResponse.json(updated);
}
