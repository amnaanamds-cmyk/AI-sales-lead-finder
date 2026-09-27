import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getManyPlaceDetails } from "@/lib/places";
import { canUse } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import type { LeadInsight, PipelineStage, PitchLanguage } from "@/lib/types";
import { Board, type Card } from "./Board";

/** Details are fetched live from Google for every card, so keep the board bounded. */
const MAX_CARDS = 150;

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/pipeline");

  const [{ data: profile }, workspace] = await Promise.all([
    supabase.from("profiles").select("name, service_type, language_pref").eq("id", user.id).single(),
    getWorkspace(supabase, user.id),
  ]);
  if (!profile?.service_type) redirect("/onboarding");
  const plan = workspace?.plan ?? "free";

  let cards: Card[] = [];
  let truncated = false;
  if (workspace && canUse(plan, "pipeline")) {
    const { data: rows } = await supabase
      .from("pipeline")
      .select("lead_id, stage, notes, next_followup, updated_at, leads!inner(place_id, workspace_id)")
      .eq("leads.workspace_id", workspace.id)
      .order("updated_at", { ascending: false })
      .limit(MAX_CARDS + 1);
    const list = (rows ?? []).slice(0, MAX_CARDS);
    truncated = (rows ?? []).length > MAX_CARDS;

    const leadIds = list.map((r) => r.lead_id as string);
    const placeIds = list.map((r) => (r.leads as unknown as { place_id: string }).place_id);
    const [details, { data: scores }, { data: checks }] = await Promise.all([
      getManyPlaceDetails(placeIds).catch(() => new Map()),
      supabase.from("lead_scores").select("lead_id, score, reason, main_gap").in("lead_id", leadIds.length ? leadIds : [""]),
      supabase.from("lead_checks").select("*").in("lead_id", leadIds.length ? leadIds : [""]),
    ]);

    cards = list.map((r, i) => {
      const s = scores?.find((x) => x.lead_id === r.lead_id);
      const c = checks?.find((x) => x.lead_id === r.lead_id);
      const insight: LeadInsight | null = c
        ? {
            check: { hasSite: c.has_site, siteLive: c.site_live, ssl: c.ssl, mobileOk: c.mobile_ok, socials: c.socials ?? {} },
            score: s ? { score: s.score, reason: s.reason, mainGap: s.main_gap ?? "" } : null,
          }
        : null;
      const lead = details.get(placeIds[i]);
      return {
        leadId: r.lead_id as string,
        stage: r.stage as PipelineStage,
        notes: (r.notes as string | null) ?? "",
        nextFollowup: (r.next_followup as string | null) ?? null,
        lead: lead ? { ...lead, leadId: r.lead_id as string } : null,
        insight,
      };
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader name={profile.name ?? user.email ?? ""} active="/pipeline" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Pipeline</h1>
        {!canUse(plan, "pipeline") ? (
          <div className="mt-6 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <p className="font-medium">Track every lead from first message to won deal.</p>
            <p className="mt-1 text-sm text-zinc-500">The pipeline board and follow-up reminders are on the Freelancer plan (PKR 1,500/month).</p>
            <Link href="/billing" className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Upgrade
            </Link>
          </div>
        ) : (
          <>
            {truncated && <p className="mt-2 text-sm text-zinc-500">Showing your {MAX_CARDS} most recently updated leads.</p>}
            <Board initialCards={cards} plan={plan} languagePref={(profile.language_pref as PitchLanguage) ?? "en"} />
          </>
        )}
      </main>
    </div>
  );
}
