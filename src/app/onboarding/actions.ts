"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isServiceId } from "@/lib/services";

const LANGUAGES = ["en", "ur", "roman_ur"];

export async function saveService(formData: FormData) {
  const service = formData.get("service");
  const language = formData.get("language");
  if (!isServiceId(service)) redirect("/onboarding?error=service");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({
      service_type: service,
      language_pref: LANGUAGES.includes(String(language)) ? language : "en",
    })
    .eq("id", user.id);

  redirect("/search");
}
