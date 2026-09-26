import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeadSearch } from "./LeadSearch";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/search");

  const [{ data: profile }, { data: workspace }] = await Promise.all([
    supabase.from("profiles").select("name, service_type").eq("id", user.id).single(),
    supabase
      .from("workspaces")
      .select("plan, credits_left")
      .eq("owner_id", user.id)
      .order("created_at")
      .limit(1)
      .single(),
  ]);
  if (!profile?.service_type) redirect("/onboarding");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/search" className="text-lg font-bold">
            Lead<span className="text-emerald-600">Nama</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">{profile.name ?? user.email}</span>
            <form action="/auth/signout" method="post">
              <button className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <LeadSearch
          initialCredits={workspace?.credits_left ?? 0}
          plan={workspace?.plan ?? "free"}
        />
      </main>
    </div>
  );
}
