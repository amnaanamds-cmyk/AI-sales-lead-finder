import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/lib/plans";

export type Workspace = {
  id: string;
  plan: Plan;
  credits_left: number;
  bonus_credits: number;
  plan_expires_at: string | null;
  credits_reset_at: string;
};

/** The signed-in user's workspace, with any due plan expiry / monthly reset applied first. */
export async function getWorkspace(supabase: SupabaseClient, userId: string): Promise<Workspace | null> {
  const select = "id, plan, credits_left, bonus_credits, plan_expires_at, credits_reset_at";
  const { data } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at")
    .limit(1)
    .single();
  if (!data) return null;

  await supabase.rpc("refresh_credits", { ws: data.id });
  const { data: ws } = await supabase.from("workspaces").select(select).eq("id", data.id).single();
  return ws as Workspace | null;
}

export function totalCredits(ws: Pick<Workspace, "credits_left" | "bonus_credits">) {
  return ws.credits_left + ws.bonus_credits;
}
