import { describe, it, expect } from "vitest";
import { parseSalary } from "@/lib/enrich/salary-parse";

describe("parseSalary", () => {
  it("parses an annual range", () => {
    const r = parseSalary("Compensation: $120,000 - $150,000 per year plus equity")!;
    expect(r.min).toBe(120_000);
    expect(r.max).toBe(150_000);
    expect(r.raw).toContain("$120,000");
  });

  it("parses a k-suffixed range", () => {
    const r = parseSalary("Salary range $120k – $150k / yr")!;
    expect(r.min).toBe(120_000);
    expect(r.max).toBe(150_000);
  });

  it("annualizes an hourly range (x2080)", () => {
    const r = parseSalary("Pay: $45.00 - $60.00/hour")!;
    expect(r.min).toBe(45 * 2080);
    expect(r.max).toBe(60 * 2080);
  });

  it("annualizes a monthly figure (x12)", () => {
    const r = parseSalary("Stipend of $8,000/month for the internship")!;
    expect(r.min).toBe(96_000);
    expect(r.max).toBe(96_000);
  });

  it("parses a single annual amount and sets min == max", () => {
    const r = parseSalary("Base salary: $135,000 annually")!;
    expect(r.min).toBe(135_000);
    expect(r.max).toBe(135_000);
  });

  it("infers hourly for a small bare number", () => {
    const r = parseSalary("This role pays $50 for the work")!;
    expect(r.min).toBe(50 * 2080);
  });

  it("infers annual for a large bare number", () => {
    const r = parseSalary("Total of $140,000 offered")!;
    expect(r.min).toBe(140_000);
  });

  it("returns null when no pay is present", () => {
    expect(parseSalary("We are hiring a software engineer. Apply now!")).toBeNull();
    expect(parseSalary("")).toBeNull();
  });

  it("rejects implausible figures (page chrome, funding numbers)", () => {
    expect(parseSalary("Backed by $5,000,000 in seed funding")).toBeNull();
    expect(parseSalary("Coffee is $5 in the cafeteria")).toBeNull();
  });

  it("handles whitespace/newlines between amount and unit", () => {
    const r = parseSalary("$120,000\n   per year")!;
    expect(r.min).toBe(120_000);
  });

  it("prefers a range over a lone amount when both could match", () => {
    const r = parseSalary("$100,000 - $130,000 base, target bonus $20,000")!;
    expect(r.min).toBe(100_000);
    expect(r.max).toBe(130_000);
  });
});
