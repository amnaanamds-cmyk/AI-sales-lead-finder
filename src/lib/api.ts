import type { Finding } from "@/lib/rules";
import type { LeadInsight, PipelineStage, PitchLanguage, PitchTone, SavedLead } from "@/lib/types";

export type SavedPitch = { language: PitchLanguage; tone: PitchTone; text: string };
export type ActionResult = { ok: true } | { ok: false; error: string };
export type QuoteItem = { item: string; pricePkr: number };
export type ReportDraft = { title: string; intro: string; findings: Finding[]; quote: QuoteItem[] };

/**
 * Everything the lead panel needs from a backend. The real app talks to the API routes
 * and server actions; the demo keeps everything in the browser.
 */
export interface LeadApi {
  loadPitches(lead: SavedLead): Promise<SavedPitch[]>;
  /** Throws an Error with a user-facing message on failure. */
  writePitch(lead: SavedLead, language: PitchLanguage, tone: PitchTone): Promise<string>;
  track(leadId: string, stage: "new" | "contacted"): Promise<ActionResult>;
  createReport(lead: SavedLead, draft: ReportDraft): Promise<string>;
  /** A follow-up message for a lead that hasn't replied. Throws on failure. */
  writeFollowUp(lead: SavedLead, language: PitchLanguage): Promise<string>;
  /** The latest report for this lead, if any. */
  existingReport(lead: SavedLead): Promise<{ url: string; views: number } | null>;
}

export type SearchParams = { category: string; area: string; city: string };
export type SearchResult = { query: string; leads: SavedLead[]; newLeads: number; skipped: number; creditsLeft: number };
export type AnalyzeResult = { insights: Record<string, LeadInsight>; scoringError: string | null };

export interface SearchApi {
  /** Throws an Error with a user-facing message on failure. */
  search(params: SearchParams): Promise<SearchResult>;
  analyze(batch: SavedLead[]): Promise<AnalyzeResult>;
}

export type CardPatch = { stage?: PipelineStage; notes?: string; nextFollowup?: string | null; dealValue?: number | null };

export interface BoardApi {
  update(leadId: string, patch: CardPatch): Promise<ActionResult>;
  remove(leadId: string): Promise<ActionResult>;
}

/** Everything the app UI needs from a backend. */
export type AppApi = { lead: LeadApi; search: SearchApi; board: BoardApi };
