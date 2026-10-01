import { describe, expect, it } from "vitest";
import { searchDemo } from "@/app/demo/data";
import { buildFindings, gapKeyFromText, ruleScore, templateFollowUp, templatePitch } from "@/lib/rules";
import type { Lead, SiteCheck } from "@/lib/types";

const busy: Lead = {
  placeId: "p",
  name: "Khyber Tikka House",
  category: "Restaurant",
  address: "University Road, Peshawar",
  phone: "+92 300 1234567",
  website: null,
  rating: 4.6,
  reviewCount: 412,
  mapsUrl: null,
};
const noSite: SiteCheck = { hasSite: false, siteLive: null, ssl: null, mobileOk: null, socials: {} };
const goodSite: SiteCheck = { hasSite: true, siteLive: true, ssl: true, mobileOk: true, socials: { instagram: "x", facebook: "y" } };

describe("ruleScore", () => {
  it("ranks a busy business with no website high for web developers, low for SEO", () => {
    const web = ruleScore("web_dev", busy, noSite);
    const seo = ruleScore("seo", busy, noSite);
    expect(web.score).toBeGreaterThan(80);
    expect(web.mainGap).toBe("no website");
    expect(seo.score).toBeLessThan(web.score);
  });

  it("prefers a live site with few reviews for SEO", () => {
    const few = { ...busy, reviewCount: 12 };
    expect(ruleScore("seo", few, goodSite).gapKey).toBe("few_reviews");
    expect(ruleScore("seo", few, goodSite).score).toBeGreaterThan(ruleScore("seo", busy, goodSite).score);
  });

  it("flags missing social media for social media managers", () => {
    expect(ruleScore("social_media", busy, noSite).gapKey).toBe("no_social");
    expect(ruleScore("social_media", busy, goodSite).score).toBeLessThan(ruleScore("social_media", busy, noSite).score);
  });

  it("stays within 0-97", () => {
    for (const s of ["web_dev", "design", "social_media", "seo", "video", "software"]) {
      for (const check of [noSite, goodSite]) {
        const { score } = ruleScore(s, busy, check);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(97);
      }
    }
  });
});

describe("templatePitch", () => {
  const base = { serviceId: "web_dev", senderName: "Ayesha Khan", lead: busy, gap: "no_site" as const, tone: "friendly" as const };

  it("writes short pitches in all three languages that mention the gap", () => {
    const en = templatePitch({ ...base, language: "en" });
    const ru = templatePitch({ ...base, language: "roman_ur" });
    const ur = templatePitch({ ...base, language: "ur" });
    expect(en).toContain("don't have a website");
    expect(ru).toContain("koi website nahi");
    expect(ur).toContain("ویب سائٹ نہیں");
    for (const t of [en, ru, ur]) {
      expect(t.split(/\s+/).length).toBeLessThanOrEqual(60);
      expect(t).toContain("4.6");
    }
    expect(en).toContain("This is Ayesha.");
  });

  it("maps AI-written gaps to translated phrases", () => {
    expect(gapKeyFromText("Website is not mobile-friendly")).toBe("not_mobile");
    expect(templatePitch({ ...base, gap: "only 12 Google reviews", language: "roman_ur", lead: { ...busy, reviewCount: 12 } })).toContain(
      "sirf 12 Google reviews",
    );
  });

  it("includes the report link in follow-ups", () => {
    expect(templateFollowUp({ lead: busy, days: 4, language: "en", reportUrl: "https://x/r/abc" })).toContain("https://x/r/abc");
  });
});

describe("buildFindings", () => {
  it("explains gaps in plain language", () => {
    const f = buildFindings({ ...busy, reviewCount: 8 }, noSite);
    expect(f.find((x) => x.key === "site")).toMatchObject({ ok: false, title: "No website" });
    expect(f.find((x) => x.key === "reviews")).toMatchObject({ ok: false });
  });
});

describe("demo search", () => {
  it("finds sample businesses by type and city, with synonyms", () => {
    expect(searchDemo("Restaurants", "University Road", "Peshawar").length).toBeGreaterThanOrEqual(4);
    expect(searchDemo("beauty parlour", "", "Lahore").length).toBeGreaterThanOrEqual(3);
    expect(searchDemo("gyms", "", "Karachi").every((b) => b.lead.category === "Gym")).toBe(true);
    expect(searchDemo("restaurants", "", "Quetta")).toHaveLength(0);
  });
});
