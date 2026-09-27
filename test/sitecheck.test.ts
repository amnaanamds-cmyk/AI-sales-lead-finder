import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) =>
    host === "internal.example" ? [{ address: "10.1.2.3" }] : [{ address: "93.184.216.34" }],
  ),
}));

const { checkSite } = await import("@/lib/sitecheck");

function html(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": "text/html", ...headers } });
}

afterEach(() => vi.unstubAllGlobals());

describe("checkSite (mocked network)", () => {
  it("detects a live, secure, mobile-ready site and its social profiles", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        html(`<html><head><meta content="width=device-width, initial-scale=1" name="viewport"></head>
          <a href="https://www.facebook.com/sharer.php?u=x">share</a>
          <a href="https://www.facebook.com/KababjeesPK/">fb</a>
          <a href='https://instagram.com/kababjees'>ig</a></html>`),
      ),
    );
    expect(await checkSite("kababjees.pk")).toEqual({
      hasSite: true,
      siteLive: true,
      ssl: true,
      mobileOk: true,
      socials: { facebook: "https://www.facebook.com/KababjeesPK", instagram: "https://instagram.com/kababjees" },
    });
  });

  it("falls back to http and reports no SSL / not mobile-friendly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        if (url.protocol === "https:") throw new Error("ECONNREFUSED");
        return html("<html><head><title>Old site</title></head></html>");
      }),
    );
    expect(await checkSite("http://oldsite.pk")).toMatchObject({ siteLive: true, ssl: false, mobileOk: false });
  });

  it("follows redirects but blocks a redirect into a private network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => html("", 302, { location: "http://internal.example/admin" })),
    );
    expect(await checkSite("https://shop.pk")).toMatchObject({ hasSite: true, siteLive: false });
  });

  it("reports a broken site", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => html("nope", 500)));
    expect(await checkSite("https://broken.pk")).toMatchObject({ siteLive: false, ssl: true, mobileOk: null });
  });
});
