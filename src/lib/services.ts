/** What the user sells. Drives lead scoring and pitches. */
export const SERVICES = [
  {
    id: "web_dev",
    label: "I build websites",
    noun: "website developer",
    fit: "Best fit: no website, a broken site, no HTTPS or not mobile-friendly — plus good ratings and many reviews, which show a busy business that can pay.",
  },
  {
    id: "design",
    label: "I do graphic / brand design",
    noun: "graphic and brand designer",
    fit: "Best fit: an active business (good reviews) with a weak or dated online presence — no website or a basic one, few social profiles.",
  },
  {
    id: "social_media",
    label: "I manage social media",
    noun: "social media manager",
    fit: "Best fit: a consumer-facing business with good reviews but no Instagram/Facebook/TikTok linked, or only one platform.",
  },
  {
    id: "seo",
    label: "I do SEO / Google ranking",
    noun: "SEO specialist",
    fit: "Best fit: has a working website but few Google reviews or a low review count for its category — they have something to rank but aren't being found.",
  },
  {
    id: "video",
    label: "I edit videos / reels",
    noun: "video editor",
    fit: "Best fit: a visual, consumer-facing business (food, salons, fashion, gyms, real estate) with Instagram/TikTok/Facebook links and good reviews.",
  },
  {
    id: "software",
    label: "I sell software (POS, accounting, etc.)",
    noun: "business software provider",
    fit: "Best fit: busy businesses with many reviews (high volume of customers and transactions), such as restaurants, pharmacies, retail and clinics.",
  },
] as const;

export type ServiceId = (typeof SERVICES)[number]["id"];

export function isServiceId(value: unknown): value is ServiceId {
  return SERVICES.some((s) => s.id === value);
}

export function getService(id: string) {
  return SERVICES.find((s) => s.id === id) ?? SERVICES[0];
}
