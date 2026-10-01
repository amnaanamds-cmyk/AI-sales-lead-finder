import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CopyButton } from "@/components/CopyButton";
import { SERVICES } from "@/lib/services";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "./actions";

const ERRORS: Record<string, string> = {
  service: "Please pick a service.",
  whatsapp: "That WhatsApp number doesn't look right. Use a format like 0300 1234567.",
  portfolio: "That portfolio link isn't a valid web address.",
  save: "Couldn't save. Please try again.",
};

const field = "mt-1 w-full rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const [{ data: profile }, { data: referrals }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, service_type, language_pref, whatsapp, portfolio_url, referral_code")
      .eq("id", user.id)
      .single(),
    supabase.rpc("referral_count"),
  ]);
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const refLink = profile?.referral_code ? `${origin}/?ref=${profile.referral_code}` : null;
  const counts = (referrals ?? { signed_up: 0, rewarded: 0 }) as { signed_up: number; rewarded: number };
  const shareText = `I find local clients with LeadNama: it shows which businesses need a website or social media and writes the WhatsApp pitch. 20 free leads a month: ${refLink}`;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader name={profile?.name ?? user.email ?? ""} active="/settings" />
      <main className="mx-auto w-full max-w-lg flex-1 space-y-10 px-4 py-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        {typeof error === "string" && ERRORS[error] && <p className="text-sm text-red-600">{ERRORS[error]}</p>}
        {saved && <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>}

        <form action={saveSettings} className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium">Your name (shown on pitches and reports)</span>
            <input name="name" defaultValue={profile?.name ?? ""} maxLength={80} className={field} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">What you sell</span>
            <select name="service" defaultValue={profile?.service_type ?? "web_dev"} className={field}>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-zinc-500">Changing this re-scores your leads for the new service.</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Preferred pitch language</span>
            <select name="language" defaultValue={profile?.language_pref ?? "en"} className={field}>
              <option value="en">English</option>
              <option value="roman_ur">Roman Urdu</option>
              <option value="ur">اردو (Urdu)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Your WhatsApp number</span>
            <input name="whatsapp" defaultValue={profile?.whatsapp ?? ""} placeholder="0300 1234567" inputMode="tel" className={field} />
            <span className="mt-1 block text-xs text-zinc-500">Adds a “Reply on WhatsApp” button to your reports.</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Portfolio link</span>
            <input name="portfolio_url" defaultValue={profile?.portfolio_url ?? ""} placeholder="behance.net/you or your website" className={field} />
            <span className="mt-1 block text-xs text-zinc-500">Shown on reports as “See previous work”.</span>
          </label>
          <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">Save</button>
        </form>

        {refLink && (
          <section className="space-y-3 rounded-xl border border-emerald-600/50 p-5">
            <h2 className="text-lg font-semibold">Invite friends, get a free month</h2>
            <p className="text-sm text-zinc-500">
              When someone joins with your link and makes their first payment, you get 30 days of the Freelancer plan
              free (or 30 more days of your current paid plan).
            </p>
            <div className="flex gap-2">
              <input readOnly value={refLink} className={`${field} mt-0 font-mono text-xs`} />
              <CopyButton text={refLink} />
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:brightness-95"
            >
              Share on WhatsApp
            </a>
            <p className="text-sm">
              <strong>{counts.signed_up}</strong> joined with your link · <strong>{counts.rewarded}</strong> free month
              {counts.rewarded === 1 ? "" : "s"} earned
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
