"use client";

import { useState } from "react";
import type { QuoteItem, ReportDraft } from "@/lib/api";
import { buildFindings, REPORT_INTRO } from "@/lib/rules";
import type { ServiceId } from "@/lib/services";
import type { SavedLead, SiteCheck } from "@/lib/types";

const input = "w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700";

export function ReportEditor({
  lead,
  check,
  serviceId,
  onCancel,
  onCreate,
}: {
  lead: SavedLead;
  check: SiteCheck;
  serviceId: string;
  onCancel: () => void;
  onCreate: (draft: ReportDraft) => Promise<void>;
}) {
  const [title, setTitle] = useState(lead.name);
  const [intro, setIntro] = useState(REPORT_INTRO[serviceId as ServiceId] ?? REPORT_INTRO.web_dev);
  const [findings, setFindings] = useState(() => buildFindings(lead, check).map((f) => ({ ...f, include: true })));
  const [quote, setQuote] = useState<{ item: string; price: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const items: QuoteItem[] = quote
      .map((q) => ({ item: q.item.trim(), pricePkr: Math.round(Number(q.price.replace(/[^\d.]/g, ""))) }))
      .filter((q) => q.item && Number.isFinite(q.pricePkr) && q.pricePkr >= 0);
    try {
      await onCreate({
        title: title.trim() || lead.name,
        intro: intro.trim(),
        findings: findings.filter((f) => f.include).map((f) => ({ key: f.key, ok: f.ok, title: f.title, detail: f.detail })),
        quote: items,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the report.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        role="dialog"
        aria-label="Create report"
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Free report for {lead.name}</h2>

        <label className="block text-sm">
          <span className="font-medium">Business name on the report</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`mt-1 ${input}`} />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Your note</span>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={1500} rows={4} className={`mt-1 ${input}`} />
        </label>

        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium">Findings to include</legend>
          {findings.map((f, i) => (
            <label key={f.key} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={f.include}
                onChange={(e) => setFindings((fs) => fs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                className="mt-1 accent-emerald-600"
              />
              <span>
                <span className={f.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                  {f.ok ? "✓" : "✗"}
                </span>{" "}
                {f.title}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Quote (optional)</span>
            <button
              type="button"
              onClick={() => setQuote((q) => [...q, { item: "", price: "" }])}
              disabled={quote.length >= 10}
              className="text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
            >
              + Add item
            </button>
          </div>
          {quote.map((q, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="e.g. 5-page website with WhatsApp button"
                value={q.item}
                maxLength={120}
                onChange={(e) => setQuote((qs) => qs.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}
                className={input}
              />
              <input
                placeholder="PKR"
                inputMode="numeric"
                value={q.price}
                onChange={(e) => setQuote((qs) => qs.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                className={`${input} w-28`}
              />
              <button
                type="button"
                aria-label="Remove item"
                onClick={() => setQuote((qs) => qs.filter((_, j) => j !== i))}
                className="px-1 text-zinc-500 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          {quote.length === 0 && <p className="text-xs text-zinc-500">Add prices to turn the report into a proposal they can save as PDF.</p>}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create link"}
          </button>
        </div>
      </div>
    </div>
  );
}
