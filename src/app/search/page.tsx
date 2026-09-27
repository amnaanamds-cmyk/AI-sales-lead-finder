import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace, totalCredits } from "@/lib/workspace";
import type { PitchLanguage } from "@/lib/types";
import { LeadSearch } from "./LeadSearch";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/search");

  const [{ data: profile }, workspace] = await Promise.all([
    supabase.from("profiles").select("name, service_type, language_pref").eq("id", user.id).single(),
    getWorkspace(supabase, user.id),
  ]);
  if (!profile?.service_type) redirect("/onboarding");

  const { data: recent } = workspace
    ? await supabase
        .from("searches")
        .select("id, query, city, result_count, created_at")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };
  const seen = new Set<string>();
  const uniqueRecent = (recent ?? [])
    .filter((s) => {
      const k = `${s.query.toLowerCase()}|${s.city.toLowerCase()}`;
      return !seen.has(k) && seen.add(k);
    })
    .slice(0, 8);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader name={profile.name ?? user.email ?? ""} active="/search" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <LeadSearch
          initialCredits={workspace ? totalCredits(workspace) : 0}
          plan={workspace?.plan ?? "free"}
          languagePref={(profile.language_pref as PitchLanguage) ?? "en"}
          recent={uniqueRecent}
        />
      </main>
    </div>
  );
}
