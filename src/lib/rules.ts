/**
 * Rule-based scoring, pitches and audit findings. No AI and no network.
 * Used by the demo, and as the fallback when the Claude API is missing or failing,
 * so the product keeps working either way.
 */
import type { ServiceId } from "@/lib/services";
import type { Lead, LeadScore, PitchLanguage, PitchTone, SiteCheck } from "@/lib/types";

export type GapKey =
  | "no_site"
  | "site_down"
  | "not_mobile"
  | "no_ssl"
  | "no_social"
  | "few_reviews"
  | "busy"
  | "content"
  | "none";

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const VISUAL = /restaurant|caf[eé]|salon|beauty|spa|gym|fitness|fashion|boutique|bakery|sweet|real estate|hotel|photograph|bridal|clothing|food/i;

/** 0-50: how able to pay the business looks (busy and well-reviewed). */
function payScore(lead: Lead) {
  const volume = Math.min(40, Math.log10(lead.reviewCount + 1) * 16);
  const quality = lead.rating == null ? 0 : lead.rating >= 4 ? 10 : lead.rating >= 3.5 ? 5 : 0;
  return volume + quality;
}

function webGap(check: SiteCheck): GapKey | null {
  if (!check.hasSite) return "no_site";
  if (check.siteLive === false) return "site_down";
  if (check.mobileOk === false) return "not_mobile";
  if (check.ssl === false) return "no_ssl";
  return null;
}

/** Score a lead for a service: need (0-50) + ability to pay (0-50). */
export function ruleScore(serviceId: string, lead: Lead, check: SiteCheck): LeadScore & { gapKey: GapKey } {
  const socials = Object.keys(check.socials).length;
  const web = webGap(check);
  let need = 5;
  let gapKey: GapKey = "none";

  switch (serviceId as ServiceId) {
    case "web_dev": {
      const weights: Record<string, number> = { no_site: 50, site_down: 45, not_mobile: 35, no_ssl: 25 };
      if (web) [need, gapKey] = [weights[web], web];
      break;
    }
    case "design":
      if (web === "no_site" || web === "site_down") [need, gapKey] = [35, web];
      else if (socials === 0) [need, gapKey] = [30, "no_social"];
      else need = 15;
      break;
    case "social_media":
      if (socials === 0) [need, gapKey] = [50, "no_social"];
      else if (socials === 1) [need, gapKey] = [30, "no_social"];
      else need = 10;
      break;
    case "seo":
      if (check.siteLive && lead.reviewCount < 50) [need, gapKey] = [45, "few_reviews"];
      else if (check.siteLive && lead.reviewCount < 150) [need, gapKey] = [30, "few_reviews"];
      else if (web) [need, gapKey] = [15, web];
      else need = 10;
      break;
    case "video":
      need = (VISUAL.test(`${lead.category ?? ""} ${lead.name}`) ? 25 : 5) + (socials > 0 ? 20 : 10);
      gapKey = "content";
      break;
    case "software":
      need = lead.reviewCount >= 200 ? 45 : lead.reviewCount >= 80 ? 35 : 15;
      gapKey = "busy";
      break;
  }
  if (gapKey === "none" && lead.reviewCount < 20) gapKey = "few_reviews";

  // Capped below 100: rules are rough, leave headroom for judgement.
  const score = Math.max(0, Math.min(97, Math.round(need + payScore(lead))));
  const busy = lead.reviewCount >= 100 ? "a busy" : lead.reviewCount >= 20 ? "an established" : "a small";
  const reason =
    gapKey === "none"
      ? `Already well covered online; ${busy} business but a weaker fit for your service.`
      : `${capitalise(GAP_LABEL[gapKey](lead))}, and it's ${busy} business (${lead.reviewCount} reviews).`;
  return { score, reason, mainGap: GAP_LABEL[gapKey](lead), gapKey };
}

const GAP_LABEL: Record<GapKey, (l: Lead) => string> = {
  no_site: () => "no website",
  site_down: () => "website doesn't load",
  not_mobile: () => "website not mobile-friendly",
  no_ssl: () => "website has no HTTPS",
  no_social: () => "weak social media presence",
  few_reviews: (l) => `only ${l.reviewCount} Google reviews`,
  busy: () => "high customer volume",
  content: () => "room for more video content",
  none: () => "no obvious gap",
};

/** Map an AI-written gap back to a known key, so templates can translate it. */
export function gapKeyFromText(text: string): GapKey | null {
  const t = text.toLowerCase();
  if (/no website|without a website|doesn't have a website/.test(t)) return "no_site";
  if (/load|down|broken|not open/.test(t)) return "site_down";
  if (/mobile/.test(t)) return "not_mobile";
  if (/https|ssl|secure/.test(t)) return "no_ssl";
  if (/instagram|facebook|social|tiktok/.test(t)) return "no_social";
  if (/review/.test(t)) return "few_reviews";
  return null;
}

type Lang = Record<PitchLanguage, string>;

const GAP_TEXT: Record<PitchLanguage, (k: GapKey, l: Lead) => string> = {
  en: (k, l) =>
    ({
      no_site: "you don't have a website yet",
      site_down: "your website isn't opening",
      not_mobile: "your website is hard to use on a phone",
      no_ssl: "Chrome shows your website as 'Not secure'",
      no_social: "I couldn't find your Instagram or Facebook page",
      few_reviews: `you have only ${l.reviewCount} Google reviews`,
      busy: "you serve a lot of customers every day",
      content: "short videos could show your work to many more people",
      none: "there may be room to grow online",
    })[k],
  roman_ur: (k, l) =>
    ({
      no_site: "aap ki abhi tak koi website nahi hai",
      site_down: "aap ki website open nahi ho rahi",
      not_mobile: "aap ki website mobile par theek se nahi chalti",
      no_ssl: "Chrome mein aap ki website 'Not secure' dikhati hai",
      no_social: "mujhe aap ka Instagram ya Facebook page nahi mila",
      few_reviews: `aap ke sirf ${l.reviewCount} Google reviews hain`,
      busy: "aap ke paas customers ka kaafi rush hota hai",
      content: "short videos se aap ka kaam aur zyada logon tak pohanch sakta hai",
      none: "online mazeed growth ki gunjaish hai",
    })[k],
  ur: (k, l) =>
    ({
      no_site: "آپ کی ابھی تک کوئی ویب سائٹ نہیں ہے",
      site_down: "آپ کی ویب سائٹ کھل نہیں رہی",
      not_mobile: "آپ کی ویب سائٹ موبائل پر ٹھیک سے نہیں چلتی",
      no_ssl: "کروم میں آپ کی ویب سائٹ 'Not secure' دکھاتی ہے",
      no_social: "مجھے آپ کا Instagram یا Facebook پیج نہیں ملا",
      few_reviews: `آپ کے صرف ${l.reviewCount} گوگل ریویوز ہیں`,
      busy: "آپ کے پاس گاہکوں کا کافی رش ہوتا ہے",
      content: "مختصر ویڈیوز سے آپ کا کام زیادہ لوگوں تک پہنچ سکتا ہے",
      none: "آن لائن مزید ترقی کی گنجائش ہے",
    })[k],
};

const OFFER: Record<ServiceId, Lang> = {
  web_dev: {
    en: "We build fast, mobile-friendly websites for local businesses.",
    roman_ur: "Hum local businesses ke liye tez aur mobile-friendly websites banate hain.",
    ur: "ہم مقامی کاروباروں کے لیے تیز اور موبائل فرینڈلی ویب سائٹس بناتے ہیں۔",
  },
  design: {
    en: "We design logos, menus and branding that help local businesses stand out.",
    roman_ur: "Hum logo, menu aur branding design karte hain jo business ko alag pehchan dete hain.",
    ur: "ہم لوگو، مینو اور برانڈنگ ڈیزائن کرتے ہیں جو کاروبار کو الگ پہچان دیتے ہیں۔",
  },
  social_media: {
    en: "We manage Instagram and Facebook pages for local businesses.",
    roman_ur: "Hum local businesses ke Instagram aur Facebook pages manage karte hain.",
    ur: "ہم مقامی کاروباروں کے انسٹاگرام اور فیس بک پیجز سنبھالتے ہیں۔",
  },
  seo: {
    en: "We help local businesses show up higher on Google.",
    roman_ur: "Hum local businesses ko Google par upar lane mein madad karte hain.",
    ur: "ہم مقامی کاروباروں کو گوگل پر اوپر لانے میں مدد کرتے ہیں۔",
  },
  video: {
    en: "We make short reels and videos for local businesses.",
    roman_ur: "Hum local businesses ke liye short reels aur videos banate hain.",
    ur: "ہم مقامی کاروباروں کے لیے مختصر ریلز اور ویڈیوز بناتے ہیں۔",
  },
  software: {
    en: "We set up simple POS and accounting software for businesses like yours.",
    roman_ur: "Hum aap jaise businesses ke liye asaan POS aur accounting software lagate hain.",
    ur: "ہم آپ جیسے کاروباروں کے لیے آسان POS اور اکاؤنٹنگ سافٹ ویئر لگاتے ہیں۔",
  },
};

const QUESTION: Record<PitchTone, Lang> = {
  friendly: {
    en: "Would you like me to share a quick idea?",
    roman_ur: "Kya main aap ko ek chhota sa idea share karoon?",
    ur: "کیا میں آپ کو ایک چھوٹا سا آئیڈیا بھیج دوں؟",
  },
  formal: {
    en: "Would you be open to a short call this week?",
    roman_ur: "Kya is hafte ek mukhtasar call ho sakti hai?",
    ur: "کیا اس ہفتے ایک مختصر کال ممکن ہے؟",
  },
};

/** A short WhatsApp pitch built from templates (gender-neutral Urdu). */
export function templatePitch(opts: {
  serviceId: string;
  senderName: string | null;
  lead: Lead;
  gap: GapKey | string;
  language: PitchLanguage;
  tone: PitchTone;
}): string {
  const { lead, language: lang, tone } = opts;
  const key: GapKey | null =
    opts.gap in GAP_LABEL ? (opts.gap as GapKey) : gapKeyFromText(opts.gap);
  const gapText = key ? GAP_TEXT[lang](key, lead) : opts.gap;
  const sender = opts.senderName?.split(" ")[0];
  const rating = lead.rating?.toFixed(1);
  const praised = lead.rating != null && lead.rating >= 4 && lead.reviewCount >= 10;
  const offer = (OFFER[opts.serviceId as ServiceId] ?? OFFER.web_dev)[lang];
  const question = QUESTION[tone][lang];

  if (lang === "en") {
    return [
      tone === "formal" ? `Assalam o Alaikum, ${lead.name} team.` : `Hi ${lead.name} team!`,
      praised ? `Your ${rating}★ rating from ${lead.reviewCount} reviews is impressive.` : `I came across ${lead.name} on Google Maps.`,
      sender ? `This is ${sender}.` : "",
      `I noticed ${gapText}.`,
      offer,
      question,
    ].filter(Boolean).join(" ");
  }
  if (lang === "roman_ur") {
    return [
      "Assalam o Alaikum!",
      praised ? `${lead.name} ki ${rating}★ rating aur ${lead.reviewCount} reviews dekh kar bohat acha laga.` : `Google Maps par ${lead.name} dekha.`,
      sender ? `Main ${sender} hoon.` : "",
      `Maine dekha ke ${gapText}.`,
      offer,
      question,
    ].filter(Boolean).join(" ");
  }
  return [
    "السلام علیکم!",
    praised ? `${lead.name} کی ${rating}★ ریٹنگ اور ${lead.reviewCount} ریویوز دیکھ کر بہت اچھا لگا۔` : `گوگل میپس پر ${lead.name} دیکھا۔`,
    sender ? `میں ${sender} ہوں۔` : "",
    `میں نے دیکھا کہ ${gapText}۔`,
    offer,
    question,
  ].filter(Boolean).join(" ");
}

/** A polite follow-up for a lead that hasn't replied. */
export function templateFollowUp(opts: { lead: Lead; days: number; language: PitchLanguage; reportUrl?: string | null }) {
  const { lead, days, language } = opts;
  const when = Math.max(1, days);
  const link = opts.reportUrl ? ` ${opts.reportUrl}` : "";
  if (language === "roman_ur") {
    return `Assalam o Alaikum ${lead.name} team, ${when} din pehle maine aap ko message kiya tha.${
      link ? ` Aap ke business ki free report yahan hai:${link}` : ""
    } Kya aap ke liye ek free idea bhej doon? Koi obligation nahi.`;
  }
  if (language === "ur") {
    return `السلام علیکم! ${when} دن پہلے میں نے ${lead.name} کو پیغام بھیجا تھا۔${
      link ? ` آپ کے کاروبار کی مفت رپورٹ یہاں ہے:${link}` : ""
    } کیا آپ کے کاروبار کے لیے ایک مفت آئیڈیا بھیج دوں؟ کوئی پابندی نہیں۔`;
  }
  return `Hi ${lead.name} team, just following up on my message from ${when} day${when === 1 ? "" : "s"} ago.${
    link ? ` Here's a free check-up of your online presence:${link}` : ""
  } Happy to share one free idea for your business, no obligation. Would that help?`;
}

export type Finding = { key: string; ok: boolean; title: string; detail: string };

/** Plain-language findings for a shareable audit report. Business owners are the readers. */
export function buildFindings(lead: Lead, check: SiteCheck): Finding[] {
  const f: Finding[] = [];
  if (!check.hasSite) {
    f.push({
      key: "site",
      ok: false,
      title: "No website",
      detail: "People searching on Google can't see your services, prices or timings, or contact you in one tap. Most of these searches happen on phones.",
    });
  } else if (check.siteLive === false) {
    f.push({
      key: "site",
      ok: false,
      title: "Website isn't opening",
      detail: "Customers who click your website on Google see an error, and many will choose a competitor instead.",
    });
  } else {
    f.push({ key: "site", ok: true, title: "Website is online", detail: "Your website opens for customers." });
    f.push(
      check.ssl
        ? { key: "ssl", ok: true, title: "Secure (HTTPS)", detail: "Browsers show your site as secure." }
        : {
            key: "ssl",
            ok: false,
            title: "Shown as 'Not secure'",
            detail: "Chrome warns visitors that your site is not secure, which makes people hesitate to call or order.",
          },
    );
    if (check.mobileOk != null) {
      f.push(
        check.mobileOk
          ? { key: "mobile", ok: true, title: "Works on mobile", detail: "Your site is set up for phone screens." }
          : {
              key: "mobile",
              ok: false,
              title: "Hard to use on phones",
              detail: "Your site isn't set up for phone screens, where most of your customers are browsing.",
            },
      );
    }
  }

  const socials = Object.keys(check.socials);
  f.push(
    socials.length === 0
      ? {
          key: "social",
          ok: false,
          title: "No social media found",
          detail: "We couldn't find an Instagram or Facebook page. That's where many customers look at photos and reviews before visiting.",
        }
      : {
          key: "social",
          ok: true,
          title: `On ${socials.map((s) => s[0].toUpperCase() + s.slice(1)).join(", ")}`,
          detail: "Customers can find you on social media.",
        },
  );

  if (lead.reviewCount < 50) {
    f.push({
      key: "reviews",
      ok: false,
      title: `Only ${lead.reviewCount} Google review${lead.reviewCount === 1 ? "" : "s"}`,
      detail: "Businesses with more reviews appear higher on Google Maps and get more calls. Happy customers just need to be asked.",
    });
  } else {
    f.push({
      key: "reviews",
      ok: true,
      title: `${lead.reviewCount} Google reviews${lead.rating != null ? ` (${lead.rating.toFixed(1)}★)` : ""}`,
      detail: "Strong social proof on Google Maps.",
    });
  }
  if (lead.rating != null && lead.rating < 3.8 && lead.reviewCount >= 5) {
    f.push({
      key: "rating",
      ok: false,
      title: `Rating ${lead.rating.toFixed(1)}★`,
      detail: "Replying to reviews and asking satisfied customers to leave one can lift your rating over time.",
    });
  }
  return f;
}

export const REPORT_INTRO: Record<ServiceId, string> = {
  web_dev:
    "I put together this free check-up of how your business appears online. If it's useful, I can build you a fast, mobile-friendly website with your services, location and a WhatsApp button.",
  design:
    "I put together this free check-up of how your business appears online. If it's useful, I can design a logo, menu or social media look that makes you stand out.",
  social_media:
    "I put together this free check-up of how your business appears online. If it's useful, I can set up and run your Instagram and Facebook so new customers find you.",
  seo: "I put together this free check-up of how your business appears online. If it's useful, I can help you rank higher on Google and get more reviews.",
  video: "I put together this free check-up of how your business appears online. If it's useful, I can make short reels and videos that show your work.",
  software:
    "I put together this free check-up of your business. If it's useful, I can set up simple POS and accounting software to save you time every day.",
};
