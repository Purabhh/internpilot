import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { classifyByRules, companyFromSender } from "@/lib/tracker/classifier-rules";

function load(name: string) {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), `tests/fixtures/emails/${name}.json`), "utf-8"),
  );
}

describe("classifyByRules", () => {
  it("flags rejection template", () => {
    const r = classifyByRules(load("rejection"));
    expect(r.status).toBe("rejected");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("flags HackerRank as OA → screen", () => {
    const r = classifyByRules(load("oa-invite"));
    expect(r.status).toBe("screen");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("flags Calendly link as interview", () => {
    const r = classifyByRules(load("calendly"));
    expect(r.status).toBe("interview");
    expect(r.confidence).toBeGreaterThan(0.6);
  });

  it("flags 'thank you for applying' as applied", () => {
    const r = classifyByRules(load("applied"));
    expect(r.status).toBe("applied");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("rejection wins over applied when both keywords appear", () => {
    // Edge case: real-world rejection emails often open with "Thanks for applying"
    // before delivering the bad news. Rejection must run first.
    const r = classifyByRules({
      from: "noreply@greenhouse.io",
      subject: "Update on your application",
      snippet: "Thanks for applying to Citadel. Unfortunately we won't be moving forward.",
    });
    expect(r.status).toBe("rejected");
  });

  it("keyword groups catch 'thanks' + 'application' variants", () => {
    const r = classifyByRules({
      from: "noreply@x.com",
      subject: "Thanks!",
      snippet: "Your application is in our system.",
    });
    expect(r.status).toBe("applied");
  });

  it("keyword groups catch 'received' + 'application'", () => {
    const r = classifyByRules({
      from: "noreply@x.com",
      subject: "We received your application",
      snippet: "Hi there, we'll review and get back to you.",
    });
    expect(r.status).toBe("applied");
  });

  it("keyword groups catch 'submitted your application'", () => {
    const r = classifyByRules({
      from: "noreply@x.com",
      subject: "Application Submitted",
      snippet: "You successfully submitted your application to the role.",
    });
    expect(r.status).toBe("applied");
  });

  it("does not fire applied on cold outreach (no application keyword)", () => {
    const r = classifyByRules({
      from: "recruiter@x.com",
      subject: "Thanks for connecting",
      snippet: "Would love to chat about an opportunity.",
    });
    expect(r.status).toBeNull();
  });

  it("EDGE 3: extracts company from 'your <Company> application' (no preposition)", () => {
    // The exact shape that dropped Tesla into needs-review previously.
    const r = classifyByRules({
      from: "noreply@notify.tesla.com",
      subject: "Thank you – we've received your Tesla application",
      snippet: "We'll be in touch.",
    });
    expect(r.status).toBe("applied");
    expect(r.company).toBe("Tesla");
  });

  it("EDGE 3: 'applying to Figure' + name in snippet yields just the company", () => {
    // Regression: greedy capture across the subject→snippet boundary produced
    // "Figure Purabh" (company + the recipient's first name) in production.
    const r = classifyByRules({
      from: "no-reply@us.greenhouse-mail.io",
      subject: "Thank you for applying to Figure",
      snippet: "Hi Purabh, thanks for your interest — we'll review your application.",
    });
    expect(r.status).toBe("applied");
    expect(r.company).toBe("Figure");
  });

  it("EDGE 3: falls back to the From display name when the body has no company", () => {
    const r = classifyByRules({
      from: "Stripe Careers <no-reply@greenhouse.io>",
      subject: "Thanks for applying!",
      snippet: "Your application has been received.",
    });
    expect(r.status).toBe("applied");
    expect(r.company).toBe("Stripe");
  });
});

describe("companyFromSender", () => {
  it("returns the display name, stripping generic role words", () => {
    expect(companyFromSender("Tesla Careers <noreply@tesla.com>")).toBe("Tesla");
    expect(companyFromSender("Stripe <jobs@stripe.com>")).toBe("Stripe");
  });

  it("strips 'via <ATS>' suffixes", () => {
    expect(companyFromSender("Tesla via Greenhouse <no-reply@greenhouse.io>")).toBe("Tesla");
  });

  it("returns null for an ATS-only display name (no real company)", () => {
    expect(companyFromSender("Greenhouse <no-reply@greenhouse.io>")).toBeNull();
  });

  it("returns null when there's no display name", () => {
    expect(companyFromSender("noreply@tesla.com")).toBeNull();
  });

  it("returns null for ambiguous recruiter chatter", () => {
    const r = classifyByRules(load("ambiguous"));
    expect(r.status).toBeNull();
  });
});
