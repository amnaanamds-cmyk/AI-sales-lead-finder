/** What the user sells. Drives lead scoring and pitches in later weeks. */
export const SERVICES = [
  { id: "web_dev", label: "I build websites" },
  { id: "design", label: "I do graphic / brand design" },
  { id: "social_media", label: "I manage social media" },
  { id: "seo", label: "I do SEO / Google ranking" },
  { id: "video", label: "I edit videos / reels" },
  { id: "software", label: "I sell software (POS, accounting, etc.)" },
] as const;

export type ServiceId = (typeof SERVICES)[number]["id"];

export function isServiceId(value: unknown): value is ServiceId {
  return SERVICES.some((s) => s.id === value);
}
