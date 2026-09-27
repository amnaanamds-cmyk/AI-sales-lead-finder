/** A business as returned to the browser. Fetched live, never stored (see docs/PROJECT.md §11). */
export type Lead = {
  placeId: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  mapsUrl: string | null;
};

/** A lead saved in the user's workspace. */
export type SavedLead = Lead & { leadId: string };

export type SiteCheck = {
  hasSite: boolean;
  siteLive: boolean | null;
  ssl: boolean | null;
  mobileOk: boolean | null;
  socials: Record<string, string>;
};

export type LeadScore = { score: number; reason: string; mainGap: string };

export type LeadInsight = { check: SiteCheck; score: LeadScore | null };

export type PipelineStage = "new" | "contacted" | "replied" | "meeting" | "won" | "lost";

export const STAGES: { id: PipelineStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "meeting", label: "Meeting" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export type PitchLanguage = "en" | "ur" | "roman_ur";
export type PitchTone = "formal" | "friendly";

export const LANGUAGES: { id: PitchLanguage; label: string }[] = [
  { id: "en", label: "English" },
  { id: "roman_ur", label: "Roman Urdu" },
  { id: "ur", label: "اردو" },
];
