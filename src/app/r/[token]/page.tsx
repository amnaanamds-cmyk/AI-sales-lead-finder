import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ReportView, type ReportData } from "@/components/ReportView";
import { supabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

/** Link-preview fetchers (WhatsApp, Facebook, Telegram…) shouldn't count as the business opening it. */
const BOT = /bot|crawler|spider|preview|whatsapp|facebookexternalhit|telegram|slack|discord|skype|curl|wget|headless/i;

async function load(token: string, count: boolean): Promise<ReportData | null> {
  if (!supabaseConfigured() || !/^[\w-]{8,40}$/.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("view_report", { p_token: token, p_count: count });
  if (error) console.error(error);
  return (data as ReportData | null) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/r/[token]">): Promise<Metadata> {
  const { token } = await params;
  const report = await load(token, false);
  return {
    title: report ? `${report.title}: free online check-up` : "Report not found",
    description: report?.sender.name ? `Prepared by ${report.sender.name}` : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const h = await headers();
  const report = await load(token, !BOT.test(h.get("user-agent") ?? ""));
  if (!report) notFound();

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const home = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
  return <ReportView report={report} homeUrl={home} />;
}
