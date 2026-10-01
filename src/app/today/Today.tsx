"use client";

import { useState } from "react";
import type { AppApi } from "@/lib/api";
import { whatsappUrl } from "@/lib/phone";
import { canUse, type Plan } from "@/lib/plans";
import { LANGUAGES, type PipelineStage, type PitchLanguage, type SavedLead } from "@/lib/types";

export type TodayItem = {
  leadId: string;
  placeId: string;
  /** viewed: opened your report this week · due: follow-up date reached · waiting: no reply 3+ days */
  reason: "viewed" | "due" | "waiting";
  stage: PipelineStage | null;
  reportViews: number;
  lastViewedAt: string | null;
  daysSinceContact: number | null;
  dealValue: number | null;
  lead: SavedLead | null;
};

export type Stats = {
  contacted: number;
  replied: number;
  meetings: number;
  won: number;
  won_value: number;
  won_this_month: number;
  open_value: number;
  report_views: number;
  leads: number;
  paid_total: number;
};

function pkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function inDays(n: number) {
  const d = new Date(Date.now() + 5 * 60 * 60 * 1000 + n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

const SECTIONS: { reason: TodayItem["reason"]; title: string; hint: string }[] = [
  { reason: "viewed", title: "🔥 Opened your report", hint: "They're interested right now. Message them while you're on their mind." },
  { reason: "due", title: "⏰ Follow-ups due", hint: "You planned to check back with these today." },
  { reason: "waiting", title: "💬 No reply yet", hint: "Most deals need a second message. A polite follow-up after 3 days is normal." },
];

export function Today({
  items: initialItems,
  more,
  stats,
  plan,
  languagePref,
  api,
  searchHref = "/search",
  billingHref = "/billing",
  onFindLeads,
}: {
  items: TodayItem[];
  more: number;
  stats: Stats;
  plan: Plan;
  languagePref: PitchLanguage;
  api: AppApi;
  searchHref?: string;
  billingHref?: string;
  /** Used instead of `searchHref` when the search lives on the same page (demo). */
  onFindLeads?: () => void;
}) {
  const [items, setItems] = useState(initialItems);
  const pipelineOn = canUse(plan, "pipeline");
  const replyRate = stats.contacted ? Math.round((stats.replied / stats.contacted) * 100) : null;
  const winRate = stats.contacted ? Math.round((stats.won / stats.contacted) * 100) : null;
  const roi = stats.paid_total > 0 && stats.won_value > 0 ? Math.floor(stats.won_value / stats.paid_total) : null;

  const done = (leadId: string) => setItems((xs) => xs.filter((x) => x.leadId !== leadId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-sm text-zinc-500">Who to message now, and how your outreach is going.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Contacted" value={String(stats.contacted)} />
        <Tile label="Reply rate" value={replyRate == null ? "—" : `${replyRate}%`} sub={`${stats.replied} replied`} />
        <Tile label="Meetings" value={String(stats.meetings)} />
        <Tile label="Clients won" value={String(stats.won)} sub={stats.won_value ? pkr(stats.won_value) : winRate != null ? `${winRate}% of contacted` : undefined} strong />
        <Tile label="Report opens" value={String(stats.report_views)} />
      </section>
      {roi != null && roi >= 1 && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          Deals you&apos;ve won are worth <strong>{roi}×</strong> what you&apos;ve paid for LeadNama.
        </p>
      )}
      {stats.open_value > 0 && <p className="text-sm text-zinc-500">{pkr(stats.open_value)} in open deals.</p>}

      {!pipelineOn && (
        <p className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          Follow-up reminders and reply tracking are on the Freelancer plan.{" "}
          <a href={billingHref} className="font-medium text-emerald-700 underline dark:text-emerald-400">
            Upgrade
          </a>
          . Report opens are shown on every plan.
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="font-medium">Nothing to chase right now.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Send pitches with a report link, and leads who open it or need a follow-up will show up here.
          </p>
          <a
            href={searchHref}
            onClick={(e) => {
              if (onFindLeads) {
                e.preventDefault();
                onFindLeads();
              }
            }}
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Find new leads
          </a>
        </div>
      ) : (
        SECTIONS.map((sec) => {
          const list = items.filter((i) => i.reason === sec.reason);
          if (!list.length) return null;
          return (
            <section key={sec.reason}>
              <h2 className="text-lg font-semibold">
                {sec.title} <span className="font-normal text-zinc-400">{list.length}</span>
              </h2>
              <p className="text-sm text-zinc-500">{sec.hint}</p>
              <ul className="mt-3 space-y-3">
                {list.map((item) => (
                  <FollowUpCard
                    key={item.leadId}
                    item={item}
                    api={api}
                    pipelineOn={pipelineOn}
                    allLanguages={canUse(plan, "allLanguages")}
                    languagePref={languagePref}
                    onDone={() => done(item.leadId)}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
      {more > 0 && <p className="text-sm text-zinc-500">{more} more after these.</p>}
    </div>
  );
}

function Tile({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "border-emerald-600" : "border-zinc-200 dark:border-zinc-800"}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function FollowUpCard({
  item,
  api,
  pipelineOn,
  allLanguages,
  languagePref,
  onDone,
}: {
  item: TodayItem;
  api: AppApi;
  pipelineOn: boolean;
  allLanguages: boolean;
  languagePref: PitchLanguage;
  onDone: () => void;
}) {
  const [language, setLanguage] = useState<PitchLanguage>(allLanguages ? languagePref : "en");
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lead = item.lead;

  const why =
    item.reason === "viewed"
      ? `Opened your report ${item.reportViews}× · last ${item.lastViewedAt ? ago(item.lastViewedAt) : ""}`
      : item.reason === "due"
        ? "Follow-up date reached"
        : `Contacted ${item.daysSinceContact} days ago, no reply yet`;

  async function write() {
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      setText(await api.lead.writeFollowUp(lead, language));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't write a follow-up.");
    } finally {
      setBusy(false);
    }
  }

  async function move(patch: Parameters<AppApi["board"]["update"]>[1]) {
    // A report opener may not be on the board yet.
    if (item.stage == null) await api.lead.track(item.leadId, "contacted");
    const r = await api.board.update(item.leadId, patch);
    if (r.ok) onDone();
    else setError(r.error);
  }

  const wa = lead && text ? whatsappUrl(lead.phone, text) : null;

  return (
    <li className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{lead?.name ?? "Business unavailable"}</p>
          <p className="text-sm text-zinc-500">
            {why}
            {item.dealValue ? ` · ${pkr(item.dealValue)}` : ""}
          </p>
        </div>
        {lead && !text && (
          <button
            onClick={write}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? "Writing…" : "Write follow-up"}
          </button>
        )}
      </div>

      {text != null && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-1 text-xs">
            {LANGUAGES.map((l) => (
              <button
                key={l.id}
                disabled={busy || (l.id !== "en" && !allLanguages)}
                onClick={() => {
                  setLanguage(l.id);
                  setText(null);
                }}
                className={`rounded px-2 py-0.5 disabled:opacity-40 ${language === l.id ? "bg-emerald-600 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            dir={language === "ur" ? "rtl" : "ltr"}
            rows={4}
            className="w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700"
          />
          <div className="flex flex-wrap gap-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // Sent: check again in 3 days unless they reply.
                  if (pipelineOn) void move({ nextFollowup: inDays(3) });
                }}
                className="rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95"
              >
                Open in WhatsApp
              </a>
            ) : (
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(text).catch(() => {});
                  if (pipelineOn) void move({ nextFollowup: inDays(3) });
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Copy (no WhatsApp number)
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {pipelineOn && (
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <button onClick={() => void move({ stage: "replied", nextFollowup: null })} className="text-emerald-700 hover:underline dark:text-emerald-400">
            They replied
          </button>
          <button onClick={() => void move({ nextFollowup: inDays(3) })} className="text-zinc-500 hover:underline">
            Remind me in 3 days
          </button>
          <button onClick={() => void move({ stage: "lost", nextFollowup: null })} className="text-zinc-500 hover:underline">
            Not interested
          </button>
        </div>
      )}
    </li>
  );
}
