import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkSite } from "@/lib/sitecheck";
import { AiError, SCORE_BATCH_SIZE, scoreLeads } from "@/lib/ai";
import type { LeadInsight, LeadScore, SiteCheck } from "@/lib/types";

export const maxDuration = 60;

/** Site checks older than this are re-run. */
const CHECK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const LeadSchema = z.object({
  leadId: z.string().uuid(),
  placeId: z.string().max(300),
  name: z.string().max(300),
  category: z.string().max(200).nullable(),
  address: z.string().max(500).nullable(),
  phone: z.string().max(50).nullable(),
  website: z.string().max(2000).nullable(),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0),
  mapsUrl: z.string().max(2000).nullable(),
});
const BodySchema = z.object({ leads: z.array(LeadSchema).min(1).max(SCORE_BATCH_SIZE) });

/**
 * Check websites and AI-score a batch of leads (at most one scoring call per request).
 * Results are cached per lead, so re-opening a search costs nothing.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const input = parsed.data.leads;

  const { data: profile } = await supabase
    .from("profiles")
    .select("service_type")
    .eq("id", user.id)
    .single();
  const service = profile?.service_type ?? "web_dev";

  // RLS limits this to the user's own leads; anything else is dropped.
  const ids = input.map((l) => l.leadId);
  const [{ data: owned }, { data: checkRows }, { data: scoreRows }] = await Promise.all([
    supabase.from("leads").select("id, place_id").in("id", ids),
    supabase.from("lead_checks").select("*").in("lead_id", ids),
    supabase.from("lead_scores").select("*").in("lead_id", ids),
  ]);
  const ownedPlace = new Map((owned ?? []).map((r) => [r.id as string, r.place_id as string]));
  const leads = input.filter((l) => ownedPlace.get(l.leadId) === l.placeId);

  const checks = new Map<string, SiteCheck>();
  for (const r of checkRows ?? []) {
    if (Date.now() - new Date(r.checked_at).getTime() < CHECK_TTL_MS) {
      checks.set(r.lead_id, {
        hasSite: r.has_site,
        siteLive: r.site_live,
        ssl: r.ssl,
        mobileOk: r.mobile_ok,
        socials: r.socials ?? {},
      });
    }
  }
  const scores = new Map<string, LeadScore>();
  for (const r of scoreRows ?? []) {
    if (r.service_type === service) {
      scores.set(r.lead_id, { score: r.score, reason: r.reason, mainGap: r.main_gap ?? "" });
    }
  }

  // 1. Website checks, in parallel.
  const toCheck = leads.filter((l) => !checks.has(l.leadId));
  const newChecks = await Promise.all(toCheck.map((l) => checkSite(l.website)));
  toCheck.forEach((l, i) => checks.set(l.leadId, newChecks[i]));
  if (toCheck.length) {
    await supabase.from("lead_checks").upsert(
      toCheck.map((l, i) => ({
        lead_id: l.leadId,
        has_site: newChecks[i].hasSite,
        site_live: newChecks[i].siteLive,
        ssl: newChecks[i].ssl,
        mobile_ok: newChecks[i].mobileOk,
        socials: newChecks[i].socials,
        checked_at: new Date().toISOString(),
      })),
    );
  }

  // 2. One batched scoring call for everything not yet scored for this service.
  const toScore = leads.filter((l) => !scores.has(l.leadId));
  let scoringError: string | null = null;
  if (toScore.length) {
    try {
      const fresh = await scoreLeads(
        service,
        toScore.map((l) => ({ id: l.leadId, lead: l, check: checks.get(l.leadId)! })),
      );
      const rows = toScore.flatMap((l) => {
        const s = fresh.get(l.leadId);
        if (!s) return [];
        scores.set(l.leadId, s);
        return [{
          lead_id: l.leadId,
          score: s.score,
          reason: s.reason,
          main_gap: s.mainGap,
          service_type: service,
          scored_at: new Date().toISOString(),
        }];
      });
      if (rows.length) await supabase.from("lead_scores").upsert(rows);
    } catch (err) {
      console.error(err);
      scoringError = err instanceof AiError ? err.message : "AI scoring is unavailable right now.";
    }
  }

  const insights: Record<string, LeadInsight> = {};
  for (const l of leads) {
    insights[l.leadId] = { check: checks.get(l.leadId)!, score: scores.get(l.leadId) ?? null };
  }
  return NextResponse.json({ insights, scoringError });
}
