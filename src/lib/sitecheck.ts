import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SiteCheck } from "@/lib/types";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36 LeadNamaBot/1.0";

const SOCIAL_HOSTS: Record<string, RegExp> = {
  facebook: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i,
  instagram: /(^|\.)instagram\.com$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/i,
  linkedin: /(^|\.)linkedin\.com$/i,
};

/** Share buttons and embeds aren't the business's own profile. */
const NOT_A_PROFILE = /\/(sharer|share|plugins|dialog|intent|tr)(\.php)?([/?]|$)/i;

function socialKind(url: URL): string | null {
  for (const [kind, re] of Object.entries(SOCIAL_HOSTS)) {
    if (re.test(url.hostname)) return kind;
  }
  return null;
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Block requests to internal networks (SSRF). Website URLs come from third-party listings. */
async function assertPublicHost(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("bad port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error("private address");
  }
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

/** Fetch following redirects by hand, so every hop gets the private-address check. */
async function safeFetch(start: URL, signal: AbortSignal): Promise<{ res: Response; url: URL }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
      cache: "no-store",
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      url = new URL(location, url);
      continue;
    }
    return { res, url };
  }
  throw new Error("too many redirects");
}

function findSocials(html: string, base: URL): Record<string, string> {
  const found: Record<string, string> = {};
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(m[1], base);
    } catch {
      continue;
    }
    const kind = socialKind(url);
    if (kind && !found[kind] && !NOT_A_PROFILE.test(url.pathname) && url.pathname.length > 1) {
      found[kind] = `${url.origin}${url.pathname}`.replace(/\/$/, "");
    }
  }
  return found;
}

function hasMobileViewport(html: string): boolean {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some(
    ([tag]) => /name\s*=\s*["']?viewport/i.test(tag) && /width\s*=\s*device-width/i.test(tag),
  );
}

/**
 * Check a business's website: does it exist, load, use HTTPS, look mobile-ready,
 * and link to social profiles. Never throws.
 */
export async function checkSite(website: string | null): Promise<SiteCheck> {
  const empty: SiteCheck = { hasSite: false, siteLive: null, ssl: null, mobileOk: null, socials: {} };
  if (!website) return empty;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  } catch {
    return empty;
  }

  // Lots of small businesses list a Facebook/Instagram page as their "website".
  const kind = socialKind(url);
  if (kind) return { ...empty, socials: { [kind]: url.toString() } };

  // Try HTTPS first even if the listing says http://, to see whether SSL is set up.
  const httpsUrl = new URL(url);
  httpsUrl.protocol = "https:";

  let result: { res: Response; url: URL } | null = null;
  for (const candidate of url.protocol === "https:" ? [httpsUrl] : [httpsUrl, url]) {
    try {
      result = await safeFetch(candidate, AbortSignal.timeout(TIMEOUT_MS));
      break;
    } catch {
      // try the next candidate
    }
  }
  if (!result) return { ...empty, hasSite: true, siteLive: false, ssl: false };

  const { res, url: finalUrl } = result;
  const live = res.status < 400;
  const html = live ? await readCapped(res).catch(() => "") : "";
  if (!live) await res.body?.cancel().catch(() => {});

  return {
    hasSite: true,
    siteLive: live,
    ssl: finalUrl.protocol === "https:",
    mobileOk: live ? hasMobileViewport(html) : null,
    socials: findSocials(html, finalUrl),
  };
}
