"use client";

import { useState } from "react";
import type { Lead } from "@/lib/types";
import { toCsv } from "@/lib/csv";

type Result = { query: string; leads: Lead[] };

const CSV_COLUMNS: { key: keyof Lead; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "rating", label: "Rating" },
  { key: "reviewCount", label: "Reviews" },
  { key: "address", label: "Address" },
  { key: "mapsUrl", label: "Google Maps" },
];

export function LeadSearch({
  initialCredits,
  plan,
}: {
  initialCredits: number;
  plan: string;
}) {
  const [credits, setCredits] = useState(initialCredits);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      setResult({ query: data.query, leads: data.leads });
      setCredits(data.creditsLeft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!result) return;
    const csv = toCsv(result.leads, CSV_COLUMNS);
    // BOM so Excel opens Urdu text correctly.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadnama-${result.query.replace(/[^\w]+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Find leads</h1>
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{credits}</span>{" "}
          lead credits left · <span className="capitalize">{plan}</span> plan
        </p>
      </div>

      <form
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

      {credits <= 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          You&apos;ve used all your lead credits for this month.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-zinc-500">
              {result.leads.length} businesses for “{result.query}”
            </p>
            <button
              onClick={exportCsv}
              disabled={result.leads.length === 0}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 font-medium">Business</th>
                  <th className="px-3 py-2 font-medium">Rating</th>
                  <th className="px-3 py-2 font-medium">Website</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {result.leads.map((lead) => (
                  <LeadRow key={lead.placeId} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>
          {/* Attribution required by the Google Maps Platform terms. */}
          <p className="text-right text-xs text-zinc-500">Business data © Google</p>
        </section>
      )}
    </div>
  );
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

function LeadRow({ lead }: { lead: Lead }) {
  return (
    <tr className="align-top">
      <td className="px-3 py-2">
        <div className="font-medium">
          {lead.mapsUrl ? (
            <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {lead.name}
            </a>
          ) : (
            lead.name
          )}
        </div>
        <div className="text-xs text-zinc-500">
          {[lead.category, lead.address].filter(Boolean).join(" · ")}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {lead.rating != null ? `★ ${lead.rating.toFixed(1)}` : "—"}
        <span className="text-zinc-500"> ({lead.reviewCount})</span>
      </td>
      <td className="px-3 py-2">
        {lead.website ? (
          <a
            href={lead.website}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </a>
        ) : (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            No website
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {lead.phone ? (
          <a href={`tel:${lead.phone.replace(/\s+/g, "")}`} className="hover:underline">
            {lead.phone}
          </a>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
