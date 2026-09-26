import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_RESULTS, PlacesError, searchPlaces } from "@/lib/places";

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

  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .select("id, credits_left")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .single();
  if (wsError || !workspace) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }
  if (workspace.credits_left <= 0) {
    return NextResponse.json(
      { error: "You're out of lead credits for this month." },
      { status: 402 },
    );
  }

  const location = [area, city].filter(Boolean).join(", ");
  const query = `${category} in ${location}, Pakistan`;

  let leads;
  try {
    leads = await searchPlaces(query, Math.min(workspace.credits_left, MAX_RESULTS));
  } catch (err) {
    console.error(err);
    const message =
      err instanceof PlacesError && err.message.includes("not set")
        ? "Search is not configured yet (missing Places API key)."
        : "Google Places search failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Charge one credit per lead returned. The RPC clamps to what's left.
  const { data: granted, error: creditError } = await supabase.rpc(
    "consume_credits",
    { ws: workspace.id, requested: leads.length },
  );
  if (creditError) {
    console.error(creditError);
    return NextResponse.json({ error: "Could not update credits." }, { status: 500 });
  }
  leads = leads.slice(0, granted as number);

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
  if (leads.length > 0) {
    await supabase.from("leads").upsert(
      leads.map((l) => ({
        workspace_id: workspace.id,
        search_id: search?.id ?? null,
        place_id: l.placeId,
      })),
      { onConflict: "workspace_id,place_id", ignoreDuplicates: true },
    );
  }

  return NextResponse.json({
    query,
    leads,
    creditsLeft: workspace.credits_left - (granted as number),
  });
}
