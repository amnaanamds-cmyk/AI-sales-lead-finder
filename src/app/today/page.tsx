import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getManyPlaceDetails } from "@/lib/places";
import { canUse } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import type { PipelineStage, PitchLanguage } from "@/lib/types";
import type { Stats, TodayItem } from "./Today";
import { TodayClient } from "./TodayClient";

const DAY = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 30;

/** Server-side clock; kept out of the component body (React purity rule). */
const nowMs = () => Date.now();

function today() {
  // Pakistan time: what "today" means to the user.
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/today");

  const [{ data: profile }, workspace] = await Promise.all([
    supabase.from("profiles").select("name, service_type, language_pref").eq("id", user.id).single(),
    getWorkspace(supabase, user.id),
  ]);
  if (!profile?.service_type || !workspace) redirect("/onboarding");
  const pipelineOn = canUse(workspace.plan, "pipeline");

  const since = new Date(nowMs() - 7 * DAY).toISOString();
  const [{ data: pipeline }, { data: viewedReports }, { data: stats }, { data: paid }] = await Promise.all([
    pipelineOn
      ? supabase
          .from("pipeline")
          .select("lead_id, stage, next_followup, deal_value, leads!inner(place_id, workspace_id)")
          .eq("leads.workspace_id", workspace.id)
          .order("updated_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("reports")
      .select("lead_id, view_count, last_viewed_at, leads!inner(place_id)")
      .eq("workspace_id", workspace.id)
      .gte("last_viewed_at", since)
      .order("last_viewed_at", { ascending: false })
      .limit(50),
    supabase.rpc("workspace_stats", { ws: workspace.id }),
    supabase.from("payments").select("amount").eq("workspace_id", workspace.id).eq("status", "paid"),
  ]);

  type Row = { leadId: string; placeId: string; stage: PipelineStage | null; nextFollowup: string | null; dealValue: number | null };
  const rows = new Map<string, Row>();
  for (const p of pipeline ?? []) {
    rows.set(p.lead_id, {
      leadId: p.lead_id,
      placeId: (p.leads as unknown as { place_id: string }).place_id,
      stage: p.stage,
      nextFollowup: p.next_followup,
      dealValue: p.deal_value,
    });
  }

  const ids = (pipeline ?? []).filter((p) => p.stage === "contacted").map((p) => p.lead_id);
  const { data: contactedEvents } = ids.length
    ? await supabase.from("pipeline_events").select("lead_id, at").in("lead_id", ids).eq("stage", "contacted")
    : { data: [] };
  const contactedAt = new Map<string, number>();
  for (const e of contactedEvents ?? []) {
    contactedAt.set(e.lead_id, Math.max(contactedAt.get(e.lead_id) ?? 0, new Date(e.at).getTime()));
  }

  // Priority: they opened your report > a follow-up you scheduled is due > no reply after 3 days.
  const items: Omit<TodayItem, "lead">[] = [];
  const seen = new Set<string>();
  for (const r of viewedReports ?? []) {
    const row = rows.get(r.lead_id);
    if (seen.has(r.lead_id) || row?.stage === "won" || row?.stage === "lost") continue;
    seen.add(r.lead_id);
    items.push({
      leadId: r.lead_id,
      placeId: (r.leads as unknown as { place_id: string }).place_id,
      reason: "viewed",
      stage: row?.stage ?? null,
      reportViews: r.view_count,
      lastViewedAt: r.last_viewed_at,
      daysSinceContact: null,
      dealValue: row?.dealValue ?? null,
    });
  }
  const t = today();
  for (const row of rows.values()) {
    if (seen.has(row.leadId) || !row.stage || ["new", "won", "lost"].includes(row.stage)) continue;
    const at = contactedAt.get(row.leadId);
    const days = at ? Math.floor((nowMs() - at) / DAY) : null;
    const due = row.nextFollowup && row.nextFollowup <= t;
    const waiting = !row.nextFollowup && row.stage === "contacted" && days != null && days >= 3;
    if (!due && !waiting) continue;
    seen.add(row.leadId);
    items.push({
      leadId: row.leadId,
      placeId: row.placeId,
      reason: due ? "due" : "waiting",
      stage: row.stage,
      reportViews: 0,
      lastViewedAt: null,
      daysSinceContact: days,
      dealValue: row.dealValue,
    });
  }
  const shown = items.slice(0, MAX_ITEMS);
  const details = await getManyPlaceDetails(shown.map((i) => i.placeId)).catch(() => new Map());

  const s = (stats ?? {}) as Partial<Stats>;
  const fullStats: Stats = {
    contacted: s.contacted ?? 0,
    replied: s.replied ?? 0,
    meetings: s.meetings ?? 0,
    won: s.won ?? 0,
    won_value: s.won_value ?? 0,
    won_this_month: s.won_this_month ?? 0,
    open_value: s.open_value ?? 0,
    report_views: s.report_views ?? 0,
    leads: s.leads ?? 0,
    paid_total: (paid ?? []).reduce((sum, p) => sum + p.amount, 0),
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader name={profile.name ?? user.email ?? ""} active="/today" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <TodayClient
          items={shown.map((i) => {
            const lead = details.get(i.placeId);
            return { ...i, lead: lead ? { ...lead, leadId: i.leadId } : null };
          })}
          more={items.length - shown.length}
          stats={fullStats}
          plan={workspace.plan}
          languagePref={(profile.language_pref as PitchLanguage) ?? "en"}
        />
      </main>
    </div>
  );
}
