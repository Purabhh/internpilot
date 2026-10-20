import { describe, it, expect } from "vitest";
import { jobType } from "@/lib/jobs/job-type";
import { freshDb } from "@/tests/helpers/test-db";
import { listJobs, countJobs, createManualJob, listJobsToEnrich } from "@/lib/db/queries/jobs";

const NG = '["New Grad"]';

describe("jobType", () => {
  it("trusts an intern title over a new-grad feed tag", () => {
    expect(jobType({ role: "Software Engineer - Intern", source: "simplify_newgrad", terms: NG })).toBe("internship");
    expect(jobType({ role: "SWE Internship, Summer 2027", source: "jobright_swe_newgrad", terms: null })).toBe("internship");
    expect(jobType({ role: "Software Engineer Co-Op", source: "simplify_newgrad", terms: NG })).toBe("internship");
    expect(jobType({ role: "Technology Apprentice - Application Developer", source: "simplify_newgrad", terms: NG })).toBe("internship");
  });

  it("does not read 'internal' or 'international' as intern", () => {
    expect(jobType({ role: "Software Engineer, Internal Tools", source: "simplify_newgrad", terms: NG })).toBe("newgrad");
    expect(jobType({ role: "International Payments Engineer", source: "simplify_newgrad", terms: NG })).toBe("newgrad");
  });

  it("trusts a new-grad title over an internship feed", () => {
    expect(jobType({ role: "Software Engineer New Grad 2027", source: "jobright_swe_internship", terms: null })).toBe("newgrad");
    expect(jobType({ role: "Early Career Software Engineer", source: "vansh_summer27_offseason", terms: null })).toBe("newgrad");
  });

  it("treats grad-school student jobs as internships, not new grad", () => {
    expect(jobType({ role: "Graduate Research Assistant", source: "jobright_swe_internship", terms: null })).toBe("internship");
    expect(jobType({ role: "Graduate Student 1 - UAV Design", source: "jobright_swe_internship", terms: null })).toBe("internship");
    expect(jobType({ role: "Graduate Web Developer", source: "jobright_swe_internship", terms: null })).toBe("newgrad");
    expect(jobType({ role: "Software Engineer, Student Loans", source: "simplify_newgrad", terms: NG })).toBe("newgrad");
  });

  it("reads a season tag on a new-grad feed as a start date", () => {
    expect(jobType({ role: "Jr. Software Engineer - Java", source: "jobright_swe_newgrad", terms: '["Fall 2026"]' })).toBe("newgrad");
    expect(jobType({ role: "Software Engineer", source: "manual", terms: '["Fall 2026"]' })).toBe("internship");
  });

  it("falls back to feed tags, then the source", () => {
    expect(jobType({ role: "Software Engineer", source: "simplify_summer26_offseason", terms: '["Fall 2026"]' })).toBe("internship");
    expect(jobType({ role: "Software Engineer", source: "jobright_swe_internship", terms: null })).toBe("internship");
    expect(jobType({ role: "Software Engineer", source: "simplify_newgrad", terms: NG })).toBe("newgrad");
    expect(jobType({ role: "Software Engineer", source: "manual", terms: null })).toBe("newgrad");
  });
});

describe("listJobs type filter", () => {
  function seed() {
    const db = freshDb();
    const rows: Array<[string, string, string | null]> = [
      ["Software Engineer - Intern", "simplify_newgrad", NG],
      ["Software Engineer I", "simplify_newgrad", NG],
      ["Backend Engineer", "jobright_swe_internship", null],
      ["Software Engineer, Internal Tools", "simplify_newgrad", NG],
    ];
    rows.forEach(([role, source, terms], i) =>
      createManualJob(db, {
        source, sourceId: String(i), company: `C${i}`, role, location: null, url: `u${i}`, postedAt: 100 + i, terms,
      }),
    );
    return db;
  }

  it("splits internships from new grad and counts match", () => {
    const db = seed();
    expect(listJobs(db, { type: "internship" }).map((j) => j.role).sort()).toEqual([
      "Backend Engineer", "Software Engineer - Intern",
    ]);
    expect(listJobs(db, { type: "newgrad" }).map((j) => j.role).sort()).toEqual([
      "Software Engineer I", "Software Engineer, Internal Tools",
    ]);
    expect(countJobs(db, { type: "internship" })).toBe(2);
  });
});

describe("listJobsToEnrich", () => {
  it("puts niche postings first, then the newest of the rest", () => {
    const db = freshDb();
    createManualJob(db, { source: "manual", sourceId: "a", company: "Raydar", role: "SWE", location: null, url: "a", postedAt: 300 });
    createManualJob(db, { source: "manual", sourceId: "b", company: "Mastercard", role: "Software Engineer I", location: null, url: "b", postedAt: 100 });
    createManualJob(db, { source: "manual", sourceId: "c", company: "Boeing", role: "SWE", location: null, url: "c", postedAt: 200 });
    expect(listJobsToEnrich(db, 2).map((j) => j.company)).toEqual(["Mastercard", "Raydar"]);
    expect(listJobsToEnrich(db, 10).map((j) => j.company)).toEqual(["Mastercard", "Raydar", "Boeing"]);
  });
});
