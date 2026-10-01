"use client";

import { useRef, useState } from "react";
import { GapChips, LeadPanel, ScoreBadge } from "@/components/LeadPanel";
import type { AppApi, SearchResult } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { canUse, type Plan } from "@/lib/plans";
import type { LeadInsight, PitchLanguage, SavedLead } from "@/lib/types";

type Result = Omit<SearchResult, "creditsLeft">;
export type RecentSearch = { id: string; query: string; city: string; result_count: number; created_at: string };

const BATCH = 10;

export function LeadSearch({
  initialCredits,
  plan,
  languagePref,
  recent,
  serviceId,
  api,
  billingHref = "/billing",
  attribution = "Business data © Google",
  examples = [],
  allowDownloads = true,
}: {
  initialCredits: number;
  plan: Plan;
  languagePref: PitchLanguage;
  recent: RecentSearch[];
  serviceId: string;
  api: AppApi;
  billingHref?: string;
  attribution?: string;
  /** Example searches shown as one-tap chips (used by the demo). */
  examples?: { category: string; area?: string; city: string }[];
  /** False inside viewers that block file downloads. */
  allowDownloads?: boolean;
}) {
  const [credits, setCredits] = useState(initialCredits);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [insights, setInsights] = useState<Record<string, LeadInsight>>({});
  const [analyzing, setAnalyzing] = useState(0);
  const [open, setOpen] = useState<SavedLead | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const runId = useRef(0);

  /** Check websites and score leads in batches of 10, two batches at a time. */
  async function analyze(leads: SavedLead[], run: number) {
    const batches: SavedLead[][] = [];
    for (let i = 0; i < leads.length; i += BATCH) batches.push(leads.slice(i, i + BATCH));
    setAnalyzing(batches.length);

    let next = 0;
    const worker = async () => {
      while (next < batches.length && run === runId.current) {
        const batch = batches[next++];
        try {
          const data = await api.search.analyze(batch);
          if (run !== runId.current) return;
          setInsights((prev) => ({ ...prev, ...data.insights }));
          if (data.scoringError) setScoringError(data.scoringError);
        } catch (err) {
          setScoringError(err instanceof Error ? err.message : "Analysis failed. Check your connection.");
        } finally {
          if (run === runId.current) setAnalyzing((n) => n - 1);
        }
      }
    };
    await Promise.all([worker(), worker()]);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await runSearch({
      category: String(form.get("category") ?? ""),
      area: String(form.get("area") ?? ""),
      city: String(form.get("city") ?? ""),
    });
  }

  async function runSearch(params: { category: string; area: string; city: string }) {
    const run = ++runId.current;
    setLoading(true);
    setError(null);
    setScoringError(null);
    setInsights({});
    try {
      const data = await api.search.search(params);
      setResult(data);
      setCredits(data.creditsLeft);
      void analyze(data.leads, run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function fillForm(category: string, area: string, city: string) {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("category") as HTMLInputElement).value = category;
    (form.elements.namedItem("area") as HTMLInputElement).value = area;
    (form.elements.namedItem("city") as HTMLInputElement).value = city;
  }

  function fillRecent(s: RecentSearch) {
    const [category, area] = s.query.split(", ");
    fillForm(category ?? "", area ?? "", s.city);
  }

  const sorted = result
    ? [...result.leads].sort(
        (a, b) => (insights[b.leadId]?.score?.score ?? -1) - (insights[a.leadId]?.score?.score ?? -1),
      )
    : [];

  function exportCsv() {
    if (!result) return;
    const rows = sorted.map((l) => {
      const ins = insights[l.leadId];
      return {
        ...l,
        score: ins?.score?.score ?? "",
        reason: ins?.score?.reason ?? "",
        mainGap: ins?.score?.mainGap ?? "",
        socials: ins ? Object.values(ins.check.socials).join(" ") : "",
      };
    });
    const csv = toCsv(rows, [
      { key: "name", label: "Name" },
      { key: "score", label: "Score" },
      { key: "mainGap", label: "Main gap" },
      { key: "reason", label: "Reason" },
      { key: "category", label: "Category" },
      { key: "phone", label: "Phone" },
      { key: "website", label: "Website" },
      { key: "socials", label: "Social links" },
      { key: "rating", label: "Rating" },
      { key: "reviewCount", label: "Reviews" },
      { key: "address", label: "Address" },
      { key: "mapsUrl", label: "Google Maps" },
    ]);
    // BOM so Excel opens Urdu text correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadnama-${result.query.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canExport = canUse(plan, "csvExport");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Find leads</h1>
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{credits}</span> lead credits left ·{" "}
          <span className="capitalize">{plan}</span> plan ·{" "}
          <a href={billingHref} className="text-emerald-700 hover:underline dark:text-emerald-400">
            Get more
          </a>
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="grid gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-[2fr_2fr_1.5fr_auto] dark:border-zinc-800"
      >
        <Field name="category" label="Business type" placeholder="Restaurants" required />
        <Field name="area" label="Area (optional)" placeholder="University Road" />
        <Field name="city" label="City" placeholder="Peshawar" required />
        <button
          disabled={loading || credits <= 0}
          className="self-end rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {recent.length > 0 && !result && (
        <div className="text-sm">
          <span className="text-zinc-500">Recent: </span>
          {recent.map((s) => (
            <button
              key={s.id}
              onClick={() => fillRecent(s)}
              className="mr-2 mt-1 rounded-full border border-zinc-300 px-2.5 py-0.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {s.query}, {s.city} <span className="text-zinc-400">({s.result_count})</span>
            </button>
          ))}
        </div>
      )}

      {examples.length > 0 && !result && (
        <div className="text-sm">
          <span className="text-zinc-500">Try: </span>
          {examples.map((x) => (
            <button
              key={`${x.category}|${x.area}|${x.city}`}
              onClick={() => {
                fillForm(x.category, x.area ?? "", x.city);
                void runSearch({ category: x.category, area: x.area ?? "", city: x.city });
              }}
              className="mr-2 mt-1 rounded-full border border-emerald-600/60 px-2.5 py-0.5 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
            >
              {x.category} in {x.area ? `${x.area}, ` : ""}
              {x.city}
            </button>
          ))}
        </div>
      )}

      {credits <= 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          You&apos;ve used all your lead credits.{" "}
          <a href={billingHref} className="underline">
            Buy a pack or upgrade
          </a>
          .
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}

      {result && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-500">
              {result.leads.length} businesses for “{result.query}” · {result.newLeads} new
              {result.skipped > 0 && ` · ${result.skipped} more hidden (out of credits)`}
              {analyzing > 0 && " · checking websites and scoring…"}
            </p>
            {allowDownloads && <button
              onClick={exportCsv}
              disabled={result.leads.length === 0 || !canExport}
              title={canExport ? undefined : "CSV export is on the Agency plan"}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Export CSV{!canExport && " 🔒"}
            </button>}
          </div>
          {scoringError && <p className="text-sm text-amber-700 dark:text-amber-400">{scoringError}</p>}

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Business</th>
                  <th className="px-3 py-2 font-medium">Rating</th>
                  <th className="px-3 py-2 font-medium">Gaps</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sorted.map((lead) => {
                  const ins = insights[lead.leadId];
                  return (
                    <tr
                      key={lead.leadId}
                      onClick={() => setOpen(lead)}
                      className="cursor-pointer align-top hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <td className="px-3 py-2">
                        {ins ? <ScoreBadge score={ins.score?.score} /> : <Spinner />}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-xs text-zinc-500">
                          {[lead.category, lead.address].filter(Boolean).join(" · ")}
                        </div>
                        {ins?.score && (
                          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{ins.score.reason}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {lead.rating != null ? `★ ${lead.rating.toFixed(1)}` : "—"}
                        <span className="text-zinc-500"> ({lead.reviewCount})</span>
                      </td>
                      <td className="px-3 py-2">{ins && <GapChips check={ins.check} lead={lead} />}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <span className="text-emerald-700 dark:text-emerald-400">Pitch →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Attribution required by the Google Maps Platform terms. */}
          <p className="text-right text-xs text-zinc-500">{attribution}</p>
        </section>
      )}

      {open && (
        <LeadPanel
          key={open.leadId}
          lead={open}
          insight={insights[open.leadId] ?? null}
          plan={plan}
          defaultLanguage={languagePref}
          serviceId={serviceId}
          api={api.lead}
          attribution={attribution}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-600" />;
}

function Field(props: { name: string; label: string; placeholder: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{props.label}</span>
      <input
        name={props.name}
        placeholder={props.placeholder}
        required={props.required}
        maxLength={80}
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
    </label>
  );
}
