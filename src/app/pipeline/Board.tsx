"use client";

import { useState } from "react";
import { LeadPanel, ScoreBadge } from "@/components/LeadPanel";
import type { AppApi, CardPatch } from "@/lib/api";
import type { Plan } from "@/lib/plans";
import { STAGES, type LeadInsight, type PipelineStage, type PitchLanguage, type SavedLead } from "@/lib/types";

export type Card = {
  leadId: string;
  stage: PipelineStage;
  notes: string;
  nextFollowup: string | null;
  dealValue: number | null;
  /** How many times the business opened your report. */
  reportViews: number;
  /** Live details from Google; null if the place no longer exists or the lookup failed. */
  lead: SavedLead | null;
  insight: LeadInsight | null;
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function pkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

export function Board({
  initialCards,
  plan,
  languagePref,
  serviceId,
  api,
  attribution = "Business data © Google",
}: {
  initialCards: Card[];
  plan: Plan;
  languagePref: PitchLanguage;
  serviceId: string;
  api: AppApi;
  attribution?: string;
}) {
  const [cards, setCards] = useState(initialCards);
  const [editing, setEditing] = useState<Card | null>(null);
  const [pitching, setPitching] = useState<Card | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(leadId: string, change: CardPatch) {
    const before = cards;
    setCards((cs) => cs.map((c) => (c.leadId === leadId ? { ...c, ...change } : c)));
    const r = await api.board.update(leadId, change);
    if (!r.ok) {
      setCards(before);
      setError(r.error);
    }
  }

  async function remove(leadId: string) {
    setCards((cs) => cs.filter((c) => c.leadId !== leadId));
    setEditing(null);
    await api.board.remove(leadId);
  }

  const due = cards.filter(
    (c) => c.nextFollowup && c.nextFollowup <= today() && c.stage !== "won" && c.stage !== "lost",
  );
  const won = cards.filter((c) => c.stage === "won");
  const wonValue = won.reduce((sum, c) => sum + (c.dealValue ?? 0), 0);
  const openValue = cards
    .filter((c) => c.stage !== "won" && c.stage !== "lost")
    .reduce((sum, c) => sum + (c.dealValue ?? 0), 0);

  if (cards.length === 0) {
    return (
      <p className="mt-6 text-zinc-500">
        No leads yet. Open a lead from a search and tap <strong>+ Pipeline</strong> or <strong>Open in WhatsApp</strong>.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
        <span>{cards.length} leads</span>
        <span className="font-medium text-emerald-700 dark:text-emerald-400">
          {won.length} won{wonValue > 0 && ` · ${pkr(wonValue)}`}
        </span>
        {openValue > 0 && <span>{pkr(openValue)} in open deals</span>}
        {due.length > 0 && (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {due.length} follow-up{due.length === 1 ? "" : "s"} due
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 overflow-x-auto pb-4 md:grid-cols-6">
        {STAGES.map((stage) => {
          const column = cards.filter((c) => c.stage === stage.id);
          return (
            <section
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging) void patch(dragging, { stage: stage.id });
                setDragging(null);
              }}
              className="min-h-32 min-w-44 rounded-xl bg-zinc-50 p-2 dark:bg-zinc-900"
            >
              <h2 className="mb-2 flex justify-between px-1 text-sm font-semibold">
                {stage.label} <span className="font-normal text-zinc-400">{column.length}</span>
              </h2>
              <div className="space-y-2">
                {column.map((c) => {
                  const overdue = c.nextFollowup && c.nextFollowup <= today() && stage.id !== "won" && stage.id !== "lost";
                  return (
                    <article
                      key={c.leadId}
                      draggable
                      onDragStart={() => setDragging(c.leadId)}
                      onClick={() => setEditing(c)}
                      className="cursor-pointer rounded-lg border border-zinc-200 bg-white p-2 text-sm shadow-sm hover:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{c.lead?.name ?? "Business unavailable"}</span>
                        <ScoreBadge score={c.insight?.score?.score} />
                      </div>
                      {c.insight?.score?.mainGap && <p className="mt-1 text-xs text-zinc-500">{c.insight.score.mainGap}</p>}
                      {c.dealValue != null && c.dealValue > 0 && <p className="mt-1 text-xs font-medium">{pkr(c.dealValue)}</p>}
                      {c.reportViews > 0 && (
                        <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          👀 Opened report {c.reportViews}×
                        </p>
                      )}
                      {c.nextFollowup && (
                        <p className={`mt-1 text-xs ${overdue ? "font-medium text-amber-700 dark:text-amber-400" : "text-zinc-500"}`}>
                          Follow up {c.nextFollowup}
                        </p>
                      )}
                      {/* Touch devices can't drag; give them a picker. */}
                      <select
                        value={c.stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => void patch(c.leadId, { stage: e.target.value as PipelineStage })}
                        className="mt-2 w-full rounded border border-zinc-200 bg-transparent p-1 text-xs md:hidden dark:border-zinc-800"
                        aria-label="Stage"
                      >
                        {STAGES.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-right text-xs text-zinc-500">{attribution}</p>

      {editing && (
        <CardEditor
          key={editing.leadId}
          card={editing}
          onClose={() => setEditing(null)}
          onSave={async (change) => {
            await patch(editing.leadId, change);
            setEditing(null);
          }}
          onRemove={() => void remove(editing.leadId)}
          onPitch={() => {
            setPitching(editing);
            setEditing(null);
          }}
        />
      )}
      {pitching?.lead && (
        <LeadPanel
          lead={pitching.lead}
          insight={pitching.insight}
          plan={plan}
          defaultLanguage={languagePref}
          serviceId={serviceId}
          api={api.lead}
          attribution={attribution}
          onClose={() => setPitching(null)}
        />
      )}
    </div>
  );
}

function CardEditor({
  card,
  onClose,
  onSave,
  onRemove,
  onPitch,
}: {
  card: Card;
  onClose: () => void;
  onSave: (change: CardPatch) => Promise<void>;
  onRemove: () => void;
  onPitch: () => void;
}) {
  const [stage, setStage] = useState(card.stage);
  const [notes, setNotes] = useState(card.notes);
  const [followup, setFollowup] = useState(card.nextFollowup ?? "");
  const [value, setValue] = useState(card.dealValue != null ? String(card.dealValue) : "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Edit lead"
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold">{card.lead?.name ?? "Business unavailable"}</h2>
          {card.lead && (
            <p className="text-sm text-zinc-500">
              {card.lead.phone ?? "No phone"}
              {card.lead.mapsUrl && (
                <>
                  {" · "}
                  <a href={card.lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Google Maps
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        <label className="block text-sm">
          <span className="font-medium">Stage</span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as PipelineStage)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Next follow-up</span>
          <input
            type="date"
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Deal value (PKR)</span>
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="e.g. 45000"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Who you spoke to, what they said, quote sent…"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({ stage, notes, nextFollowup: followup || null, dealValue: value ? Number(value) : null });
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Save
          </button>
          {card.lead && (
            <button onClick={onPitch} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
              Pitch / follow-up message
            </button>
          )}
          <button onClick={onRemove} className="ml-auto rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
