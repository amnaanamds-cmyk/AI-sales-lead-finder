"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportEditor } from "@/components/ReportEditor";
import type { LeadApi, SavedPitch } from "@/lib/api";
import { whatsappUrl } from "@/lib/phone";
import { canUse, type Plan } from "@/lib/plans";
import {
  LANGUAGES,
  type LeadInsight,
  type PitchLanguage,
  type PitchTone,
  type SavedLead,
  type SiteCheck,
} from "@/lib/types";

export function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-zinc-400">—</span>;
  const color =
    score >= 70
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : score >= 40
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`inline-block min-w-9 rounded-md px-1.5 py-0.5 text-center text-sm font-semibold ${color}`}>{score}</span>;
}

/** Human-readable list of what's missing, and what's fine. */
export function gapList(check: SiteCheck, lead: SavedLead): { label: string; bad: boolean }[] {
  const items: { label: string; bad: boolean }[] = [];
  if (!check.hasSite) items.push({ label: "No website", bad: true });
  else if (check.siteLive === false) items.push({ label: "Website doesn't load", bad: true });
  else {
    items.push({ label: "Website live", bad: false });
    items.push(check.ssl ? { label: "HTTPS", bad: false } : { label: "No HTTPS", bad: true });
    if (check.mobileOk != null) {
      items.push(check.mobileOk ? { label: "Mobile-friendly", bad: false } : { label: "Not mobile-friendly", bad: true });
    }
  }
  const socials = Object.keys(check.socials);
  items.push(socials.length ? { label: socials.join(", "), bad: false } : { label: "No social links", bad: true });
  if (lead.reviewCount < 20) items.push({ label: `Only ${lead.reviewCount} reviews`, bad: true });
  return items;
}

export function GapChips({ check, lead }: { check: SiteCheck; lead: SavedLead }) {
  return (
    <div className="flex flex-wrap gap-1">
      {gapList(check, lead).map((g) => (
        <span
          key={g.label}
          className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${
            g.bad
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {g.label}
        </span>
      ))}
    </div>
  );
}

export function LeadPanel({
  lead,
  insight,
  plan,
  defaultLanguage,
  serviceId,
  api,
  attribution = "Business data © Google",
  onClose,
}: {
  lead: SavedLead;
  insight: LeadInsight | null;
  plan: Plan;
  defaultLanguage: PitchLanguage;
  serviceId: string;
  api: LeadApi;
  attribution?: string;
  onClose: () => void;
}) {
  const allLanguages = canUse(plan, "allLanguages");
  const [initial] = useState<{ language: PitchLanguage; tone: PitchTone }>({
    language: allLanguages ? defaultLanguage : "en",
    tone: "friendly",
  });
  const [language, setLanguage] = useState(initial.language);
  const [tone, setTone] = useState(initial.tone);
  const [saved, setSaved] = useState<SavedPitch[] | null>(null);
  // User edits per language/tone, layered over the saved pitch.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingReport, setEditingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportViews, setReportViews] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .existingReport(lead)
      .then((r) => {
        if (!cancelled && r) {
          setReportUrl(r.url);
          setReportViews(r.views);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, lead]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const generate = useCallback(
    async (lang: PitchLanguage, t: PitchTone) => {
      setBusy(true);
      setError(null);
      try {
        const pitch = await api.writePitch(lead, lang, t);
        setDrafts((d) => ({ ...d, [`${lang}:${t}`]: pitch }));
        setSaved((prev) => [{ language: lang, tone: t, text: pitch }, ...(prev ?? [])]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't write a pitch.");
      } finally {
        setBusy(false);
      }
    },
    [lead, api],
  );

  const hasSaved = (list: SavedPitch[], lang: PitchLanguage, t: PitchTone) =>
    list.some((p) => p.language === lang && p.tone === t);

  /** Switch language/tone; write a pitch only if there isn't one saved (pitches are made on open, not upfront). */
  function select(lang: PitchLanguage, t: PitchTone) {
    setLanguage(lang);
    setTone(t);
    setError(null);
    if (saved && !hasSaved(saved, lang, t)) void generate(lang, t);
  }

  // Load saved pitches once.
  useEffect(() => {
    let cancelled = false;
    api
      .loadPitches(lead)
      .then((list) => {
        if (cancelled) return;
        setSaved(list);
        if (!hasSaved(list, initial.language, initial.tone)) void generate(initial.language, initial.tone);
      })
      .catch(() => !cancelled && setSaved([]));
    return () => {
      cancelled = true;
    };
    // Runs once per lead; later switches go through select().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.leadId]);

  const key = `${language}:${tone}`;
  const savedText = saved?.find((p) => p.language === language && p.tone === tone)?.text;
  const text = drafts[key] ?? savedText ?? "";
  const setText = (value: string) => setDrafts((d) => ({ ...d, [key]: value }));


  const wa = whatsappUrl(lead.phone, text);

  async function track(stage: "new" | "contacted") {
    if (!canUse(plan, "pipeline")) {
      if (stage === "new") setNotice("The pipeline board is on the Freelancer plan and above.");
      return;
    }
    const r = await api.track(lead.leadId, stage);
    setNotice(r.ok ? (stage === "new" ? "Added to your pipeline." : "Moved to Contacted in your pipeline.") : r.error);
  }

  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => {});
    setNotice("Pitch copied.");
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={lead.name}
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white p-5 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{lead.name}</h2>
            <p className="text-sm text-zinc-500">{[lead.category, lead.address].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close">
            ✕
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Rating</dt>
            <dd>{lead.rating != null ? `★ ${lead.rating.toFixed(1)} (${lead.reviewCount})` : "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Phone</dt>
            <dd>{lead.phone ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-zinc-500">Website</dt>
            <dd className="break-all">
              {lead.website ? (
                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline dark:text-emerald-400">
                  {lead.website}
                </a>
              ) : (
                "None"
              )}
            </dd>
          </div>
        </dl>

        <section className="mt-5 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ScoreBadge score={insight?.score?.score} />
            <span className="text-sm font-medium">Lead score</span>
          </div>
          {insight?.score ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{insight.score.reason}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">{insight ? "Not scored yet." : "Checking this business…"}</p>
          )}
          {insight && (
            <div className="mt-2">
              <GapChips check={insight.check} lead={lead} />
            </div>
          )}
        </section>

        <section className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto font-medium">Pitch</h3>
            <div className="flex rounded-lg border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
              {LANGUAGES.map((l) => {
                const locked = l.id !== "en" && !allLanguages;
                return (
                  <button
                    key={l.id}
                    disabled={locked || busy}
                    title={locked ? "Freelancer plan and above" : undefined}
                    onClick={() => select(l.id, tone)}
                    className={`rounded-md px-2 py-1 disabled:opacity-40 ${
                      language === l.id ? "bg-emerald-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {l.label}
                    {locked && " 🔒"}
                  </button>
                );
              })}
            </div>
            <div className="flex rounded-lg border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
              {(["friendly", "formal"] as const).map((t) => (
                <button
                  key={t}
                  disabled={busy}
                  onClick={() => select(language, t)}
                  className={`rounded-md px-2 py-1 capitalize ${
                    tone === t ? "bg-emerald-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={busy ? "Writing your pitch…" : text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            dir={language === "ur" ? "rtl" : "ltr"}
            rows={7}
            className="w-full rounded-lg border border-zinc-300 bg-transparent p-3 text-sm leading-relaxed dark:border-zinc-700"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void track("contacted")}
                className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
              >
                Open in WhatsApp
              </a>
            ) : (
              <span className="self-center text-xs text-zinc-500">No mobile number for WhatsApp.</span>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone.replace(/\s+/g, "")}`}
                onClick={() => void track("contacted")}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Call
              </a>
            )}
            <button onClick={copy} disabled={!text || busy} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
              Copy
            </button>
            <button onClick={() => void generate(language, tone)} disabled={busy} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
              Rewrite
            </button>
            <button onClick={() => void track("new")} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
              + Pipeline
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            WhatsApp opens with your message filled in. You press send, one lead at a time; bulk messaging gets numbers banned.
          </p>
          {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
        </section>

        <section className="mt-5 rounded-lg border border-dashed border-emerald-600/50 p-3">
          <h3 className="font-medium">Free report for this business</h3>
          <p className="mt-1 text-sm text-zinc-500">
            A cold message from an unknown number is easy to ignore. Send a link to a short check-up of their online
            presence, with an optional quote in PKR. You&apos;ll see when they open it.
          </p>
          {reportUrl ? (
            <div className="mt-2 space-y-2">
              {reportViews > 0 && (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  👀 Opened {reportViews} time{reportViews === 1 ? "" : "s"}. Good moment to follow up.
                </p>
              )}
              <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-emerald-700 hover:underline dark:text-emerald-400">
                {reportUrl}
              </a>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (!text.includes(reportUrl)) setText(`${text.trim()}\n\n${reportUrl}`);
                    setNotice("Report link added to your message.");
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Add link to message
                </button>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(reportUrl).catch(() => {});
                    setNotice("Report link copied.");
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Copy link
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingReport(true)}
              disabled={!insight}
              className="mt-2 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
            >
              {insight ? "Create report link" : "Waiting for website check…"}
            </button>
          )}
        </section>

        <p className="mt-auto pt-6 text-right text-xs text-zinc-500">{attribution}</p>
      </aside>
      {editingReport && insight && (
        <ReportEditor
          lead={lead}
          check={insight.check}
          serviceId={serviceId}
          onCancel={() => setEditingReport(false)}
          onCreate={async (draft) => {
            const url = await api.createReport(lead, draft);
            setReportUrl(url);
            setEditingReport(false);
            setNotice("Report ready. Add the link to your message.");
          }}
        />
      )}
    </div>
  );
}
