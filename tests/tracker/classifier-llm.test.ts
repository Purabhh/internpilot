import { describe, it, expect } from "vitest";
import { fakeAnthropic } from "@/tests/helpers/mock-anthropic";
import { classifyByLlm } from "@/lib/tracker/classifier-llm";

describe("classifyByLlm", () => {
  it("parses a well-formed JSON reply", async () => {
    const client = fakeAnthropic({
      company: "Citadel", status: "interview", confidence: 0.85, reasoning: "recruiter set a call",
    });
    const r = await classifyByLlm(client, { from: "x@y", subject: "next steps", snippet: "..." });
    expect(r.company).toBe("Citadel");
    expect(r.status).toBe("interview");
    expect(r.confidence).toBeCloseTo(0.85);
  });

  it("retries once on malformed json then gives up", async () => {
    let calls = 0;
    const client = {
      messages: {
        create: async () => {
          calls += 1;
          return { content: [{ type: "text", text: "not json at all" }] };
        },
      },
    } as never;
    const r = await classifyByLlm(client, { from: "x", subject: "", snippet: "" });
    expect(calls).toBe(2);
    expect(r.status).toBeNull();
    expect(r.reasoning).toContain("malformed");
  });

  it("clamps invalid status to null", async () => {
    const client = fakeAnthropic({ company: "X", status: "weird-status", confidence: 0.9, reasoning: "?" });
    const r = await classifyByLlm(client, { from: "x", subject: "", snippet: "" });
    expect(r.status).toBeNull();
  });
});
