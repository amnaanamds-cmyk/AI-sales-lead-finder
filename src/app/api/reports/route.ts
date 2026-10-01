import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

const MAX_REPORTS_PER_LEAD = 5;

const BodySchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  intro: z.string().max(1500),
  findings: z
    .array(
      z.object({
        key: z.string().max(30),
        ok: z.boolean(),
        title: z.string().max(120),
        detail: z.string().max(400),
      }),
    )
    .max(12),
  quote: z
    .array(z.object({ item: z.string().trim().min(1).max(120), pricePkr: z.number().int().min(0).max(100_000_000) }))
    .max(10),
});

function siteUrl(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
}

/** GET ?leadId= → the latest report link for a lead, with its view count. */
export async function GET(request: Request) {
  const leadId = new URL(request.url).searchParams.get("leadId") ?? "";
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "Invalid lead." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("token, view_count, last_viewed_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    report: data ? { url: `${siteUrl(request)}/r/${data.token}`, views: data.view_count, lastViewedAt: data.last_viewed_at } : null,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the report details." }, { status: 400 });
  const { leadId, ...draft } = parsed.data;

  const [workspace, { data: lead }, { count }] = await Promise.all([
    getWorkspace(supabase, user.id),
    supabase.from("leads").select("id, workspace_id").eq("id", leadId).maybeSingle(),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("lead_id", leadId),
  ]);
  if (!workspace || !lead || lead.workspace_id !== workspace.id) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  if ((count ?? 0) >= MAX_REPORTS_PER_LEAD) {
    return NextResponse.json({ error: "You've made the maximum number of reports for this lead." }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({ workspace_id: workspace.id, lead_id: leadId, created_by: user.id, ...draft })
    .select("token")
    .single();
  if (error || !data) {
    console.error(error);
    return NextResponse.json({ error: "Couldn't create the report." }, { status: 500 });
  }
  return NextResponse.json({ url: `${siteUrl(request)}/r/${data.token}` });
}
