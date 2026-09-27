import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_RESULTS, PlacesError, searchPlaces } from "@/lib/places";
import { getWorkspace, totalCredits } from "@/lib/workspace";
import type { SavedLead } from "@/lib/types";

type Body = { category?: unknown; area?: unknown; city?: unknown };

function text(value: unknown, max = 80): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const category = text(body.category);
  const area = text(body.area);
  const city = text(body.city);
  if (!category || !city) {
    return NextResponse.json(
      { error: "Business type and city are required." },
      { status: 400 },
    );
  }

  const workspace = await getWorkspace(supabase, user.id);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }
  const available = totalCredits(workspace);
  if (available <= 0) {
    return NextResponse.json(
      { error: "You're out of lead credits. Buy a pack or upgrade on the Billing page." },
      { status: 402 },
    );
  }

  const location = [area, city].filter(Boolean).join(", ");
  const query = `${category} in ${location}, Pakistan`;

  let found;
  try {
    // Fetch a full page even on low credits: leads already in the workspace are free.
    found = await searchPlaces(query, Math.min(Math.max(available, 20), MAX_RESULTS));
  } catch (err) {
    console.error(err);
    const message =
      err instanceof PlacesError && err.message.includes("not set")
        ? "Search is not configured yet (missing Places API key)."
        : "Google Places search failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Only businesses new to this workspace cost a credit.
  const { data: existing } = await supabase
    .from("leads")
    .select("id, place_id")
    .eq("workspace_id", workspace.id)
    .in("place_id", found.length ? found.map((l) => l.placeId) : [""]);
  const known = new Map((existing ?? []).map((r) => [r.place_id as string, r.id as string]));
  const fresh = found.filter((l) => !known.has(l.placeId));

  let granted = 0;
  if (fresh.length > 0) {
    const { data, error } = await supabase.rpc("consume_credits", {
      ws: workspace.id,
      requested: fresh.length,
    });
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Could not update credits." }, { status: 500 });
    }
    granted = data as number;
  }
  const paidFresh = new Set(fresh.slice(0, granted).map((l) => l.placeId));
  const leads = found.filter((l) => known.has(l.placeId) || paidFresh.has(l.placeId));

  const { data: search } = await supabase
    .from("searches")
    .insert({
      workspace_id: workspace.id,
      query: area ? `${category}, ${area}` : category,
      city,
      result_count: leads.length,
    })
    .select("id")
    .single();

  // Store only place_id (Google Places terms); details are fetched live.
  if (paidFresh.size > 0) {
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(
        [...paidFresh].map((placeId) => ({
          workspace_id: workspace.id,
          search_id: search?.id ?? null,
          place_id: placeId,
        })),
      )
      .select("id, place_id");
    if (error) console.error(error);
    for (const r of inserted ?? []) known.set(r.place_id, r.id);
  }

  const saved: SavedLead[] = leads.flatMap((l) => {
    const leadId = known.get(l.placeId);
    return leadId ? [{ ...l, leadId }] : [];
  });

  return NextResponse.json({
    query,
    leads: saved,
    newLeads: paidFresh.size,
    skipped: fresh.length - paidFresh.size,
    creditsLeft: available - granted,
  });
}
