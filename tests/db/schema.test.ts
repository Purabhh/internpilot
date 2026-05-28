import { describe, it, expect } from "vitest";
import { jobs, applications, resumes, emails, sources, settings } from "@/lib/db/schema";

describe("schema exports", () => {
  it("exports all tables", () => {
    expect(jobs).toBeDefined();
    expect(applications).toBeDefined();
    expect(resumes).toBeDefined();
    expect(emails).toBeDefined();
    expect(sources).toBeDefined();
    expect(settings).toBeDefined();
  });
});
