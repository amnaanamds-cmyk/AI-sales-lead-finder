import { addToPipeline, removeFromPipeline, updatePipeline } from "@/app/pipeline/actions";
import type { AnalyzeResult, AppApi, LeadApi, SavedPitch, SearchResult } from "@/lib/api";

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

function post(url: string, body: unknown) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

const lead: LeadApi = {
  async loadPitches(l) {
    const d = await json<{ pitches: SavedPitch[] }>(await fetch(`/api/pitch?leadId=${l.leadId}`));
    return d.pitches ?? [];
  },
  async writePitch(l, language, tone) {
    return (await json<{ text: string }>(await post("/api/pitch", { leadId: l.leadId, language, tone, lead: l }))).text;
  },
  track: (leadId, stage) => addToPipeline(leadId, stage),
  async writeFollowUp(l, language) {
    return (await json<{ text: string }>(await post("/api/followup", { leadId: l.leadId, language, lead: l }))).text;
  },
  async createReport(l, draft) {
    return (await json<{ url: string }>(await post("/api/reports", { leadId: l.leadId, ...draft }))).url;
  },
  async existingReport(l) {
    const d = await json<{ report: { url: string; views: number } | null }>(await fetch(`/api/reports?leadId=${l.leadId}`));
    return d.report;
  },
};

/** The real backend: API routes and server actions. */
export const realApi: AppApi = {
  lead,
  search: {
    search: async (params) => json<SearchResult>(await post("/api/search", params)),
    analyze: async (batch) => json<AnalyzeResult>(await post("/api/analyze", { leads: batch })),
  },
  board: {
    update: (leadId, patch) => updatePipeline(leadId, patch),
    remove: (leadId) => removeFromPipeline(leadId),
  },
};
