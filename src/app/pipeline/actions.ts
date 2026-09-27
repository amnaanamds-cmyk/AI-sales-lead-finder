"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canUse } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";
import { STAGES, type PipelineStage } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

const isStage = (s: unknown): s is PipelineStage => STAGES.some((x) => x.id === s);

async function authorised(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>> } | Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const ws = await getWorkspace(supabase, user.id);
  if (!ws || !canUse(ws.plan, "pipeline")) {
    return { ok: false, error: "The pipeline board is on the Freelancer plan and above." };
  }
  return { supabase };
}

/** Add a lead to the board. If it's already there, only move it forward from "new". */
export async function addToPipeline(leadId: string, stage: PipelineStage = "new"): Promise<Result> {
  if (!isStage(stage)) return { ok: false, error: "Invalid stage." };
  const auth = await authorised();
  if (!("supabase" in auth)) return auth;
  const { supabase } = auth;

  const { data: existing } = await supabase.from("pipeline").select("stage").eq("lead_id", leadId).maybeSingle();
  const { error } = existing
    ? existing.stage === "new" && stage !== "new"
      ? await supabase.from("pipeline").update({ stage, updated_at: new Date().toISOString() }).eq("lead_id", leadId)
      : { error: null }
    : await supabase.from("pipeline").insert({ lead_id: leadId, stage });
  if (error) return { ok: false, error: "Could not update the pipeline." };

  revalidatePath("/pipeline");
  return { ok: true };
}

export async function updatePipeline(
  leadId: string,
  patch: { stage?: PipelineStage; notes?: string; nextFollowup?: string | null },
): Promise<Result> {
  const auth = await authorised();
  if (!("supabase" in auth)) return auth;

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.stage !== undefined) {
    if (!isStage(patch.stage)) return { ok: false, error: "Invalid stage." };
    row.stage = patch.stage;
  }
  if (patch.notes !== undefined) row.notes = patch.notes.slice(0, 2000);
  if (patch.nextFollowup !== undefined) {
    if (patch.nextFollowup && !/^\d{4}-\d{2}-\d{2}$/.test(patch.nextFollowup)) {
      return { ok: false, error: "Invalid date." };
    }
    row.next_followup = patch.nextFollowup || null;
  }

  const { error } = await auth.supabase.from("pipeline").update(row).eq("lead_id", leadId);
  if (error) return { ok: false, error: "Could not save." };
  revalidatePath("/pipeline");
  return { ok: true };
}

export async function removeFromPipeline(leadId: string): Promise<Result> {
  const auth = await authorised();
  if (!("supabase" in auth)) return auth;
  await auth.supabase.from("pipeline").delete().eq("lead_id", leadId);
  revalidatePath("/pipeline");
  return { ok: true };
}
