import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { secureHash } from "@/lib/jazzcash";
import { toInternationalDigits, whatsappUrl } from "@/lib/phone";
import { canUse, productPrice } from "@/lib/plans";
import { checkSite } from "@/lib/sitecheck";

describe("phone", () => {
  it("normalises Pakistani numbers", () => {
    expect(toInternationalDigits("0300 1234567")).toBe("923001234567");
    expect(toInternationalDigits("+92 300 1234567")).toBe("923001234567");
    expect(toInternationalDigits("0092-300-1234567")).toBe("923001234567");
    expect(toInternationalDigits("091 5701234")).toBe("92915701234");
  });

  it("only offers WhatsApp for mobiles", () => {
    expect(whatsappUrl("+92 300 1234567", "Salam ji")).toBe("https://wa.me/923001234567?text=Salam%20ji");
    expect(whatsappUrl("091 5701234", "hi")).toBeNull();
    expect(whatsappUrl(null, "hi")).toBeNull();
  });
});

describe("csv", () => {
  it("quotes cells and blocks formula injection but keeps phone numbers", () => {
    const csv = toCsv(
      [{ a: '=HYPERLINK("x")', b: "+92 300 1234567", c: 'say "hi"' }],
      [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "c", label: "C" },
      ],
    );
    expect(csv).toBe('"A","B","C"\r\n"\'=HYPERLINK(""x"")","+92 300 1234567","say ""hi"""');
  });
});

describe("plans", () => {
  it("gates features by plan", () => {
    expect(canUse("free", "allLanguages")).toBe(false);
    expect(canUse("freelancer", "allLanguages")).toBe(true);
    expect(canUse("freelancer", "csvExport")).toBe(false);
    expect(canUse("agency", "csvExport")).toBe(true);
  });

  it("prices products", () => {
    expect(productPrice("freelancer")?.pricePkr).toBe(1500);
    expect(productPrice("pack_100")?.pricePkr).toBe(600);
    expect(productPrice("pack_999")).toBeNull();
  });
});

describe("jazzcash secureHash", () => {
  it("hashes salt + sorted non-empty pp_ values", () => {
    const salt = "s3cret";
    const fields = { pp_Version: "1.1", pp_Amount: "150000", pp_TxnType: "", other: "ignored", pp_SecureHash: "x" };
    const expected = createHmac("sha256", salt).update("s3cret&150000&1.1").digest("hex").toUpperCase();
    expect(secureHash(fields, salt)).toBe(expected);
  });
});

describe("checkSite", () => {
  it("reports no site", async () => {
    expect(await checkSite(null)).toMatchObject({ hasSite: false, socials: {} });
  });

  it("treats a Facebook page as a social profile, not a website", async () => {
    const r = await checkSite("https://www.facebook.com/somesalon");
    expect(r.hasSite).toBe(false);
    expect(r.socials.facebook).toContain("facebook.com/somesalon");
  });

  it("refuses to fetch private network addresses", async () => {
    for (const url of ["http://127.0.0.1", "http://169.254.169.254/latest/meta-data", "http://10.0.0.1", "http://localhost"]) {
      const r = await checkSite(url);
      expect(r).toMatchObject({ hasSite: true, siteLive: false });
    }
  });
});
