"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isServiceId } from "@/lib/services";
import { createClient } from "@/lib/supabase/server";

const LANGUAGES = ["en", "ur", "roman_ur"];

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const service = formData.get("service");
  const language = String(formData.get("language") ?? "en");
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const portfolio = String(formData.get("portfolio_url") ?? "").trim();

  if (!isServiceId(service)) redirect("/settings?error=service");
  if (whatsapp && !/^\+?[\d\s-]{10,18}$/.test(whatsapp)) redirect("/settings?error=whatsapp");
  let portfolioUrl: string | null = null;
  if (portfolio) {
    try {
      const u = new URL(/^https?:\/\//i.test(portfolio) ? portfolio : `https://${portfolio}`);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      portfolioUrl = u.toString().slice(0, 300);
    } catch {
      redirect("/settings?error=portfolio");
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name: name || null,
      service_type: service,
      language_pref: LANGUAGES.includes(language) ? language : "en",
      whatsapp: whatsapp || null,
      portfolio_url: portfolioUrl,
    })
    .eq("id", user.id);
  if (error) redirect("/settings?error=save");

  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}
