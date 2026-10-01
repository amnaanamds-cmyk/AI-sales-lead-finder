import { NextResponse } from "next/server";
import { z } from "zod";
import { aiConfigured, writeFollowUp } from "@/lib/ai";
import { canUse } from "@/lib/plans";
import { templateFollowUp } from "@/lib/rules";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const maxDuration = 60;

const BodySchema = z.object({
  leadId: z.string().uuid(),
  language: z.enum(["en", "ur", "roman_ur"]),
  lead: z.object({
    placeId: z.string().max(300),
    name: z.string().max(300),
    category: z.string().max(200).nullable(),
    address: z.string().max(500).nullable(),
    phone: z.string().max(50).nullable(),
    website: z.string().max(2000).nullable(),
    rating: z.number().min(0).max(5).nullable(),
    reviewCount: z.number().int().min(0),
    mapsUrl: z.string().max(2000).nullable(),
  }),
});

const DAY = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { leadId, lead } = parsed.data;

  const [workspace, { data: profile }, { data: owned }, { data: pitch }, { data: contacted }, { data: report }] =
    await Promise.all([
      getWorkspace(supabase, user.id),
      supabase.from("profiles").select("name, service_type").eq("id", user.id).single(),
      supabase.from("leads").select("place_id").eq("id", leadId).maybeSingle(),
      supabase.from("pitches").select("text").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("pipeline_events")
        .select("at")
        .eq("lead_id", leadId)
        .eq("stage", "contacted")
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("reports").select("token, view_count").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  if (!workspace || owned?.place_id !== lead.placeId) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  const language = canUse(workspace.plan, "allLanguages") ? parsed.data.language : "en";
  const days = contacted ? Math.max(1, Math.round((Date.now() - new Date(contacted.at).getTime()) / DAY)) : 3;
  const reportUrl = report ? `${process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin}/r/${report.token}` : null;

  let text: string | null = null;
  if (aiConfigured()) {
    try {
      text = await writeFollowUp({
        serviceId: profile?.service_type ?? "web_dev",
        senderName: profile?.name ?? null,
        lead,
        previousMessage: pitch?.text ?? null,
        days,
        reportUrl,
        reportViews: report?.view_count ?? 0,
        language,
      });
    } catch (err) {
      console.error(err);
    }
  }
  text ??= templateFollowUp({ lead, days, language, reportUrl });
  return NextResponse.json({ text });
}
