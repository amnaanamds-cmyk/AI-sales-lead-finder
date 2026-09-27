import { beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();
const betaCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { parse };
    beta = { messages: { create: betaCreate } };
  },
}));

const { scoreLeads, writePitch, AiError } = await import("@/lib/ai");

const lead = {
  placeId: "p1",
  name: "Shinwari Tikka House",
  category: "Restaurant",
  address: "University Rd, Peshawar",
  phone: "+92 300 1234567",
  website: null,
  rating: 4.5,
  reviewCount: 320,
  mapsUrl: null,
};
const check = { hasSite: false, siteLive: null, ssl: null, mobileOk: null, socials: {} };

beforeEach(() => {
  parse.mockReset();
  betaCreate.mockReset();
});

describe("scoreLeads", () => {
  it("uses the cheap model with structured output and clamps scores", async () => {
    parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { results: [{ id: "L1", score: 130, reason: "Busy, no site.", main_gap: "no website" }] },
    });
    const scores = await scoreLeads("web_dev", [{ id: "L1", lead, check }]);
    expect(scores.get("L1")).toEqual({ score: 100, reason: "Busy, no site.", mainGap: "no website" });

    const params = parse.mock.calls[0][0];
    expect(params.model).toBe("claude-haiku-4-5");
    expect(params.output_config.format).toBeDefined();
    expect(params.messages[0].content).toContain("website developer");
    expect(params.messages[0].content).toContain('"website":"none"');
  });

  it("throws when the output can't be parsed", async () => {
    parse.mockResolvedValue({ stop_reason: "max_tokens", parsed_output: null });
    await expect(scoreLeads("seo", [{ id: "L1", lead, check }])).rejects.toBeInstanceOf(AiError);
  });
});

describe("writePitch", () => {
  const opts = { serviceId: "web_dev", senderName: "Amna", lead, mainGap: "no website", language: "roman_ur" as const, tone: "friendly" as const };

  it("uses the stronger model with server-side fallbacks and returns the text", async () => {
    betaCreate.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: " Assalam o Alaikum! " }] });
    expect(await writePitch(opts)).toBe("Assalam o Alaikum!");

    const params = betaCreate.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toContain("server-side-fallback-2026-07-01");
    expect(params.messages[0].content).toContain("Roman Urdu");
    expect(params.messages[0].content).toContain("rated 4.5 from 320");
  });

  it("surfaces refusals as AiError", async () => {
    betaCreate.mockResolvedValue({ stop_reason: "refusal", content: [] });
    await expect(writePitch(opts)).rejects.toBeInstanceOf(AiError);
  });
});
