import { describe, it, expect } from "vitest";
import { matchNiche, pickResume, companyCategory } from "@/lib/niche/profile";
import { freshDb } from "@/tests/helpers/test-db";
import { listJobs, countJobs, createManualJob } from "@/lib/db/queries/jobs";

describe("matchNiche", () => {
  it.each([
    ["American Express", "Campus Undergraduate Full-Time Engineer - 2027 Software Engineer", "bank"],
    ["Robinhood", "Software Engineer, Backend", "payments"],
    ["Mastercard", "Software Engineer I", "payments"],
    ["Coinbase", "Software Engineer New Grad", "crypto"],
    ["Nasdaq", "Associate Software Developer", "markets"],
    ["The D. E. Shaw Group", "Software Developer, Futures", "trading"],
    ["Synchrony Financial", "API Engineer 1 - Credit", "bank"],
  ])("%s / %s is in the niche (%s)", (company, role, cat) => {
    const m = matchNiche(company, role);
    expect(m.inNiche).toBe(true);
    expect(m.category).toBe(cat);
  });

  it("catches fintech roles at unlisted companies by role keywords", () => {
    expect(matchNiche("Acme Corp", "Software Engineer, Payments Platform").inNiche).toBe(true);
    expect(matchNiche("Acme Corp", "Software Engineer, Ledger Services").category).toBe("role");
  });

  it("leaves out non-finance companies", () => {
    expect(matchNiche("Raydar", "Founding Software Engineer").inNiche).toBe(false);
    expect(matchNiche("Boeing", "Software Engineer - Entry Level").inNiche).toBe(false);
  });

  it("does not match short names inside other words", () => {
    expect(companyCategory("Office Depot")).toBeNull(); // "ice"
    expect(companyCategory("Design Co")).toBeNull(); // "sig"
    expect(companyCategory("Imcore")).toBeNull(); // "imc"
    expect(companyCategory("ICE Data Services")).toBe("markets");
    expect(companyCategory("SIG")).toBe("trading");
  });

  it("only counts ambiguous names when they are the whole company name", () => {
    expect(companyCategory("Mercury")).toBe("payments");
    expect(companyCategory("Mercury Systems")).toBeNull();
    expect(companyCategory("Circle Logistics")).toBeNull();
    expect(companyCategory("H&R Block")).toBeNull();
    expect(companyCategory("Block, Inc.")).toBe("payments");
    expect(companyCategory("Huntington Ingalls Industries")).toBeNull();
    expect(companyCategory("Fidelity Investments")).toBe("bank");
    expect(companyCategory("IMC Trading")).toBe("trading");
  });

  it("excludes senior, hardware and trader roles even at niche companies", () => {
    expect(matchNiche("Goldman Sachs", "Senior Software Engineer").inNiche).toBe(false);
    expect(matchNiche("Citadel", "FPGA Engineer").inNiche).toBe(false);
    expect(matchNiche("Akuna Capital", "Junior Trader").inNiche).toBe(false);
    expect(matchNiche("JPMorgan Chase", "Software Engineer III").inNiche).toBe(false);
    expect(matchNiche("Cboe", "2027 Firmware Engineering Co-Op").inNiche).toBe(false);
    expect(matchNiche("Broadridge", "Product Analyst - Virtual Events").inNiche).toBe(false);
  });
});

describe("pickResume", () => {
  it("uses the AI resume for AI, data and forward-deployed roles", () => {
    expect(pickResume("Mastercard", "AI Engineer 1 - Launch Program").resume).toBe("ai");
    expect(pickResume("Visa", "Data Science Graduate").resume).toBe("ai");
    expect(pickResume("Microsoft", "Software Engineer - Forward Deployed Engineer").resume).toBe("ai");
    expect(pickResume("State Street", "Quantitative Analyst").resume).toBe("ai");
  });

  it("uses the backend resume for backend, infra and systems roles", () => {
    expect(pickResume("Robinhood", "Software Engineer, Backend").resume).toBe("backend");
    expect(pickResume("Visa", "Software Engineer Operations and Infrastructure").resume).toBe("backend");
    expect(pickResume("Wolverine Trading", "Early Career C++ Software Engineer").resume).toBe("backend");
  });

  it("falls back on company type for generic titles", () => {
    expect(pickResume("Goldman Sachs", "Software Engineer").resume).toBe("ai");
    expect(pickResume("Coinbase", "Software Engineer").resume).toBe("backend");
    expect(pickResume("Random Startup", "Software Engineer").resume).toBe("backend");
  });

  it("does not read 'ai' inside other words", () => {
    expect(pickResume("Acme", "Software Engineer, Email Platform").resume).toBe("backend");
  });
});

describe("listJobs niche filter", () => {
  function seed() {
    const db = freshDb();
    const rows: Array<[string, string]> = [
      ["Robinhood", "Software Engineer, Backend"],
      ["Office Depot", "Software Engineer"],
      ["Goldman Sachs", "Senior Software Engineer"],
      ["Mastercard", "Software Engineer I"],
      ["Raydar", "Software Engineer"],
      ["Acme", "Payments Engineer"],
    ];
    rows.forEach(([company, role], i) =>
      createManualJob(db, {
        source: "manual", sourceId: String(i), company, role, location: "New York, NY", url: `u${i}`,
        postedAt: 1_000 + i,
      }),
    );
    return db;
  }

  it("keeps only exact niche matches and counts them consistently", () => {
    const db = seed();
    const companies = listJobs(db, { niche: true }).map((j) => j.company);
    expect(companies).toEqual(["Acme", "Mastercard", "Robinhood"]);
    expect(countJobs(db, { niche: true })).toBe(3);
    expect(countJobs(db)).toBe(6);
  });

  it("pages after the exact match, not before", () => {
    const db = seed();
    expect(listJobs(db, { niche: true, limit: 2 }).map((j) => j.company)).toEqual(["Acme", "Mastercard"]);
    expect(listJobs(db, { niche: true, limit: 2, offset: 2 }).map((j) => j.company)).toEqual(["Robinhood"]);
  });
});
