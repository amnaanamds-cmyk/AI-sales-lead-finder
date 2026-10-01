"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ReportView, type ReportData } from "@/components/ReportView";
import { SERVICES } from "@/lib/services";
import { Board, type Card } from "@/app/pipeline/Board";
import { LeadSearch } from "@/app/search/LeadSearch";
import { Today, type Stats, type TodayItem } from "@/app/today/Today";
import { DEMO_CREDITS, demoApi, demoInsight, demoSaved, pkDate, resetDemo, setDemo, useDemo } from "./demoStore";

type Tab = "today" | "search" | "pipeline";
const DAY = 24 * 60 * 60 * 1000;
const nowMs = () => Date.now();
const ATTRIBUTION = "Sample businesses for the demo. Names and numbers are fictional.";

const EXAMPLES = [
  { category: "Restaurants", area: "University Road", city: "Peshawar" },
  { category: "Salons", city: "Lahore" },
  { category: "Gyms", city: "Karachi" },
  { category: "Cafes", city: "Islamabad" },
];

function useHash() {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener("hashchange", l);
      return () => window.removeEventListener("hashchange", l);
    },
    () => window.location.hash,
    () => "",
  );
}

export function DemoApp({
  signupHref,
  signupLabel = "Sign up free",
  canPrint = true,
}: {
  signupHref: string;
  signupLabel?: string;
  /** Some embedded viewers can't open the print dialog or save files. */
  canPrint?: boolean;
}) {
  const hash = useHash();
  const state = useDemo();
  const report: ReportData | null = hash.startsWith("#report-") ? state.reportPages[hash.slice("#report-".length)] ?? null : null;
  const [tab, setTab] = useState<Tab>("search");
  const [version, setVersion] = useState(0);
  const api = useMemo(() => demoApi(), []);

  if (report) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="bg-emerald-700 px-4 py-2 text-center text-sm text-white print:hidden">
          This is how the business sees your report.{" "}
          <button onClick={() => (window.location.hash = "demo")} className="font-semibold underline">
            Back to the demo
          </button>
        </div>
        <ReportView report={report} homeUrl={typeof window === "undefined" ? "" : window.location.origin} canPrint={canPrint} />
      </div>
    );
  }

  const service = state.service;
  const cards: Card[] = Object.entries(state.pipeline).map(([leadId, p]) => ({
    leadId,
    stage: p.stage,
    notes: p.notes,
    nextFollowup: p.nextFollowup,
    dealValue: p.dealValue,
    reportViews: state.reports[leadId]?.views ?? 0,
    lead: demoSaved(leadId),
    insight: demoInsight(leadId, service),
  }));

  const now = nowMs();
  const today = pkDate(0);
  const items: TodayItem[] = [];
  for (const c of cards) {
    if (c.stage === "won" || c.stage === "lost" || c.stage === "new") continue;
    const p = state.pipeline[c.leadId];
    const r = state.reports[c.leadId];
    const days = p.contactedAt ? Math.floor((now - p.contactedAt) / DAY) : null;
    const reason: TodayItem["reason"] | null =
      r && r.views > 0 && r.lastViewedAt && now - r.lastViewedAt < 7 * DAY
        ? "viewed"
        : p.nextFollowup && p.nextFollowup <= today
          ? "due"
          : !p.nextFollowup && c.stage === "contacted" && days != null && days >= 3
            ? "waiting"
            : null;
    if (!reason) continue;
    items.push({
      leadId: c.leadId,
      placeId: c.leadId,
      reason,
      stage: c.stage,
      reportViews: r?.views ?? 0,
      lastViewedAt: r?.lastViewedAt ? new Date(r.lastViewedAt).toISOString() : null,
      daysSinceContact: days,
      dealValue: c.dealValue,
      lead: c.lead,
    });
  }
  const reached = (stages: string[]) => cards.filter((c) => stages.includes(c.stage)).length;
  const stats: Stats = {
    contacted: reached(["contacted", "replied", "meeting", "won"]),
    replied: reached(["replied", "meeting", "won"]),
    meetings: reached(["meeting", "won"]),
    won: reached(["won"]),
    won_value: cards.filter((c) => c.stage === "won").reduce((s, c) => s + (c.dealValue ?? 0), 0),
    won_this_month: reached(["won"]),
    open_value: cards.filter((c) => ["contacted", "replied", "meeting"].includes(c.stage)).reduce((s, c) => s + (c.dealValue ?? 0), 0),
    report_views: Object.values(state.reports).reduce((s, r) => s + r.views, 0),
    leads: state.owned.length,
    paid_total: 1500,
  };

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "today", label: "Today", badge: items.length },
    { id: "search", label: "Search" },
    { id: "pipeline", label: "Pipeline" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <div className="bg-emerald-700 px-4 py-2 text-center text-sm text-white">
        Live demo with sample businesses. Nothing is sent; your changes stay in this browser.{" "}
        <a href={signupHref} className="font-semibold underline">
          {signupLabel}
        </a>{" "}
        to search real Google Maps listings.
      </div>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold">
              Lead<span className="text-emerald-600">Nama</span>{" "}
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 align-middle text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                DEMO
              </span>
            </span>
            <nav className="flex gap-4 text-sm" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={tab === t.id ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"}
                >
                  {t.label}
                  {!!t.badge && (
                    <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{t.badge}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <span className="text-zinc-500">I sell</span>
              <select
                value={service}
                onChange={(e) => {
                  setDemo((d) => ({ ...d, service: e.target.value }));
                  setVersion((v) => v + 1);
                }}
                className="rounded border border-zinc-300 bg-transparent p-1 dark:border-zinc-700"
              >
                {SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label.replace(/^I /, "")}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                resetDemo();
                setVersion((v) => v + 1);
              }}
              className="text-zinc-500 hover:underline"
            >
              Reset demo
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {tab === "search" && (
          <LeadSearch
            key={`search-${version}`}
            initialCredits={state.credits}
            plan="agency"
            languagePref="en"
            recent={[]}
            serviceId={service}
            api={api}
            billingHref={signupHref}
            attribution={ATTRIBUTION}
            examples={EXAMPLES}
            allowDownloads={canPrint}
          />
        )}
        {tab === "pipeline" && (
          <>
            <h1 className="text-2xl font-bold">Pipeline</h1>
            <Board
              key={`board-${version}-${cards.length}`}
              initialCards={cards}
              plan="agency"
              languagePref="en"
              serviceId={service}
              api={api}
              attribution={ATTRIBUTION}
            />
          </>
        )}
        {tab === "today" && (
          <Today
            key={`today-${version}`}
            items={items}
            more={0}
            stats={stats}
            plan="agency"
            languagePref="en"
            api={api}
            billingHref={signupHref}
            onFindLeads={() => setTab("search")}
          />
        )}
        {state.credits < DEMO_CREDITS / 3 && tab === "search" && (
          <p className="mt-6 text-sm text-zinc-500">
            Running low on demo credits?{" "}
            <button
              onClick={() => {
                resetDemo();
                setVersion((v) => v + 1);
              }}
              className="underline"
            >
              Reset the demo
            </button>
            .
          </p>
        )}
      </main>
    </div>
  );
}
