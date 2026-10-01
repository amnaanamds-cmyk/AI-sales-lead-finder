import { useSyncExternalStore } from "react";
import type { AppApi, SavedPitch } from "@/lib/api";
import { ruleScore, templateFollowUp, templatePitch } from "@/lib/rules";
import type { LeadInsight, PipelineStage, SavedLead } from "@/lib/types";
import type { ReportData } from "@/components/ReportView";
import { DEMO_BUSINESSES, searchDemo } from "./data";

/** Everything the demo remembers, kept in this browser only. */
export type DemoState = {
  service: string;
  senderName: string;
  credits: number;
  owned: string[];
  pitches: Record<string, SavedPitch[]>;
  pipeline: Record<
    string,
    { stage: PipelineStage; notes: string; nextFollowup: string | null; dealValue: number | null; contactedAt: number | null }
  >;
  reports: Record<string, { url: string; views: number; lastViewedAt: number | null }>;
  /** Report pages created in the demo, by token (shown at #report-<token>). */
  reportPages: Record<string, ReportData>;
};

const KEY = "leadnama-demo-v1";
const DAY = 24 * 60 * 60 * 1000;
export const DEMO_CREDITS = 60;

export function pkDate(offsetDays = 0) {
  return new Date(Date.now() + 5 * 60 * 60 * 1000 + offsetDays * DAY).toISOString().slice(0, 10);
}

function seed(): DemoState {
  const now = Date.now();
  const id = (name: string) => DEMO_BUSINESSES.find((b) => b.lead.name === name)!.lead.placeId;
  return {
    service: "web_dev",
    senderName: "Ayesha",
    credits: DEMO_CREDITS,
    owned: [id("Khyber Tikka House"), id("Glamour Beauty Salon"), id("Chapli Corner"), id("Iron Fit Gym")],
    pitches: {},
    pipeline: {
      [id("Khyber Tikka House")]: { stage: "contacted", notes: "", nextFollowup: null, dealValue: 40000, contactedAt: now - 4 * DAY },
      [id("Glamour Beauty Salon")]: { stage: "contacted", notes: "", nextFollowup: null, dealValue: null, contactedAt: now - DAY },
      [id("Chapli Corner")]: { stage: "won", notes: "Mobile site + menu. Paid 50% advance.", nextFollowup: null, dealValue: 35000, contactedAt: now - 12 * DAY },
      [id("Iron Fit Gym")]: { stage: "meeting", notes: "Meeting with owner, bring gym site samples.", nextFollowup: pkDate(0), dealValue: 60000, contactedAt: now - 6 * DAY },
    },
    reports: {
      [id("Glamour Beauty Salon")]: { url: "", views: 2, lastViewedAt: now - 3 * 60 * 60 * 1000 },
    },
    reportPages: {},
  };
}

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...seed(), ...JSON.parse(raw) };
  } catch {
    // private mode or blocked storage: run from memory
  }
  return seed();
}

function current(): DemoState {
  state ??= load();
  return state;
}

export function setDemo(update: (s: DemoState) => DemoState) {
  state = update(current());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function resetDemo() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  state = seed();
  listeners.forEach((l) => l());
}

const SERVER_STATE = seed();

export function useDemo(): DemoState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    () => SERVER_STATE,
  );
}

export function demoSaved(placeId: string): SavedLead {
  const b = DEMO_BUSINESSES.find((x) => x.lead.placeId === placeId)!;
  return { ...b.lead, leadId: b.lead.placeId };
}

export function demoInsight(placeId: string, service: string): LeadInsight {
  const b = DEMO_BUSINESSES.find((x) => x.lead.placeId === placeId)!;
  const s = ruleScore(service, b.lead, b.check);
  return { check: b.check, score: { score: s.score, reason: s.reason, mainGap: s.mainGap } };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));


/** The demo backend: same interface as the real one, all in the browser. */
export function demoApi(): AppApi {
  return {
    search: {
      async search({ category, area, city }) {
        await wait(500);
        if (!category.trim() || !city.trim()) throw new Error("Business type and city are required.");
        const found = searchDemo(category, area, city);
        const s = current();
        const fresh = found.filter((b) => !s.owned.includes(b.lead.placeId));
        const granted = Math.min(fresh.length, s.credits);
        const paid = new Set(fresh.slice(0, granted).map((b) => b.lead.placeId));
        setDemo((d) => ({ ...d, credits: d.credits - granted, owned: [...d.owned, ...paid] }));
        const leads = found.filter((b) => s.owned.includes(b.lead.placeId) || paid.has(b.lead.placeId));
        return {
          query: `${category} in ${[area, city].filter(Boolean).join(", ")} (sample data)`,
          leads: leads.map((b) => ({ ...b.lead, leadId: b.lead.placeId })),
          newLeads: paid.size,
          skipped: fresh.length - granted,
          creditsLeft: current().credits,
        };
      },
      async analyze(batch) {
        await wait(700 + Math.random() * 600);
        const service = current().service;
        return {
          insights: Object.fromEntries(batch.map((l) => [l.leadId, demoInsight(l.placeId, service)])),
          scoringError: null,
        };
      },
    },
    lead: {
      async loadPitches(lead) {
        return current().pitches[lead.leadId] ?? [];
      },
      async writePitch(lead, language, tone) {
        await wait(600);
        const s = current();
        const b = DEMO_BUSINESSES.find((x) => x.lead.placeId === lead.placeId)!;
        const gap = ruleScore(s.service, b.lead, b.check).gapKey;
        const text = templatePitch({ serviceId: s.service, senderName: s.senderName, lead, gap, language, tone });
        setDemo((d) => ({ ...d, pitches: { ...d.pitches, [lead.leadId]: [{ language, tone, text }, ...(d.pitches[lead.leadId] ?? [])] } }));
        return text;
      },
      async writeFollowUp(lead, language) {
        await wait(500);
        const p = current().pipeline[lead.leadId];
        const days = p?.contactedAt ? Math.max(1, Math.round((Date.now() - p.contactedAt) / DAY)) : 3;
        const report = current().reports[lead.leadId];
        return templateFollowUp({ lead, days, language, reportUrl: report?.url || null });
      },
      async track(leadId, stage) {
        setDemo((d) => {
          const existing = d.pipeline[leadId];
          if (existing && !(existing.stage === "new" && stage !== "new")) return d;
          return {
            ...d,
            pipeline: {
              ...d.pipeline,
              [leadId]: {
                stage,
                notes: existing?.notes ?? "",
                nextFollowup: existing?.nextFollowup ?? null,
                dealValue: existing?.dealValue ?? null,
                contactedAt: stage === "contacted" ? Date.now() : existing?.contactedAt ?? null,
              },
            },
          };
        });
        return { ok: true };
      },
      async createReport(lead, draft) {
        await wait(400);
        const s = current();
        const page: ReportData = {
          ...draft,
          created_at: new Date().toISOString(),
          sender: { name: s.senderName, whatsapp: null, portfolio_url: null, service_type: s.service, referral_code: null },
        };
        // A plain #token link: it works in a normal tab and inside embedded viewers.
        const token = Math.random().toString(36).slice(2, 10);
        const url = `${window.location.origin}${window.location.pathname}#report-${token}`;
        setDemo((d) => ({
          ...d,
          reports: { ...d.reports, [lead.leadId]: { url, views: 0, lastViewedAt: null } },
          reportPages: { ...d.reportPages, [token]: page },
        }));
        return url;
      },
      async existingReport(lead) {
        const r = current().reports[lead.leadId];
        return r?.url ? { url: r.url, views: r.views } : null;
      },
    },
    board: {
      async update(leadId, patch) {
        setDemo((d) => {
          const p = d.pipeline[leadId];
          if (!p) return d;
          return {
            ...d,
            pipeline: {
              ...d.pipeline,
              [leadId]: {
                ...p,
                ...(patch.stage !== undefined && { stage: patch.stage }),
                ...(patch.notes !== undefined && { notes: patch.notes }),
                ...(patch.nextFollowup !== undefined && { nextFollowup: patch.nextFollowup }),
                ...(patch.dealValue !== undefined && { dealValue: patch.dealValue }),
                ...(patch.stage === "contacted" && !p.contactedAt && { contactedAt: Date.now() }),
              },
            },
          };
        });
        return { ok: true };
      },
      async remove(leadId) {
        setDemo((d) => {
          const pipeline = { ...d.pipeline };
          delete pipeline[leadId];
          return { ...d, pipeline };
        });
        return { ok: true };
      },
    },
  };
}
