import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiError, writePitch } from "@/lib/ai";
import { canUse } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

export const maxDuration = 60;

/** Stops one lead from burning AI spend through endless regenerations. */
const MAX_PITCHES_PER_LEAD = 12;

const BodySchema = z.object({
  leadId: z.string().uuid(),
  language: z.enum(["en", "ur", "roman_ur"]),
  tone: z.enum(["formal", "friendly"]),
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

/** GET ?leadId= returns the latest saved pitch for each language/tone. */
export async function GET(request: Request) {
  const leadId = new URL(request.url).searchParams.get("leadId");
  if (!leadId || !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "Invalid lead." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("pitches")
    .select("language, tone, text, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ pitches: data ?? [] });
}

/** Generate (spec: only when the user opens a lead) and save a pitch. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { leadId, language, tone, lead } = parsed.data;

  const [workspace, { data: profile }, { data: owned }, { data: score }, { data: check }, { count }] =
    await Promise.all([
      getWorkspace(supabase, user.id),
      supabase.from("profiles").select("name, service_type").eq("id", user.id).single(),
      supabase.from("leads").select("place_id").eq("id", leadId).maybeSingle(),
      supabase.from("lead_scores").select("main_gap").eq("lead_id", leadId).maybeSingle(),
      supabase.from("lead_checks").select("has_site, site_live, ssl, mobile_ok").eq("lead_id", leadId).maybeSingle(),
      supabase.from("pitches").select("id", { count: "exact", head: true }).eq("lead_id", leadId),
    ]);

  if (!workspace || owned?.place_id !== lead.placeId) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  if (language !== "en" && !canUse(workspace.plan, "allLanguages")) {
    return NextResponse.json(
      { error: "Urdu and Roman Urdu pitches are on the Freelancer plan and above." },
      { status: 402 },
    );
  }
  if ((count ?? 0) >= MAX_PITCHES_PER_LEAD) {
    return NextResponse.json(
      { error: "You've generated the maximum number of pitches for this lead. Edit an existing one instead." },
      { status: 429 },
    );
  }

  const mainGap =
    score?.main_gap ||
    (!check?.has_site
      ? "no website"
      : check.site_live === false
        ? "website does not load"
        : check.mobile_ok === false
          ? "website is not mobile-friendly"
          : check.ssl === false
            ? "website has no HTTPS"
            : `${lead.reviewCount} Google reviews`);

  let text: string;
  try {
    text = await writePitch({
      serviceId: profile?.service_type ?? "web_dev",
      senderName: profile?.name ?? null,
      lead,
      mainGap,
      language,
      tone,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof AiError ? "Couldn't write a pitch for this lead. Try another tone." : "AI is unavailable right now.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await supabase.from("pitches").insert({ lead_id: leadId, language, tone, text });
  return NextResponse.json({ text });
}
