import type { QuoteItem } from "@/lib/api";
import type { Finding } from "@/lib/rules";
import { getService } from "@/lib/services";
import { PrintButton } from "./PrintButton";

export type ReportData = {
  title: string;
  intro: string;
  findings: Finding[];
  quote: QuoteItem[];
  created_at: string;
  sender: {
    name: string | null;
    whatsapp: string | null;
    portfolio_url: string | null;
    service_type: string | null;
    referral_code: string | null;
  };
};

function pkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

function waDigits(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  else if (d.startsWith("0")) d = `92${d.slice(1)}`;
  return d;
}

/** The page a business owner sees. Plain language, works on a phone, prints to a clean PDF. */
export function ReportView({ report, homeUrl, canPrint = true }: { report: ReportData; homeUrl: string; canPrint?: boolean }) {
  const { sender } = report;
  const issues = report.findings.filter((f) => !f.ok);
  const good = report.findings.filter((f) => f.ok);
  const total = report.quote.reduce((sum, q) => sum + q.pricePkr, 0);
  const date = new Date(report.created_at).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });
  const reply = sender.whatsapp
    ? `https://wa.me/${waDigits(sender.whatsapp)}?text=${encodeURIComponent(`Assalam o Alaikum, I saw the report for ${report.title}. I'd like to know more.`)}`
    : null;
  const ref = sender.referral_code ? `${homeUrl}/?ref=${sender.referral_code}` : homeUrl;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 print:py-0">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Free online check-up</p>
      <h1 className="mt-1 text-3xl font-bold">{report.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Prepared {sender.name ? `by ${sender.name}` : ""}
        {sender.service_type ? ` (${getService(sender.service_type).noun})` : ""} · {date}
      </p>

      {report.intro && <p className="mt-6 whitespace-pre-line leading-relaxed">{report.intro}</p>}

      {issues.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What could bring you more customers</h2>
          <ul className="mt-3 space-y-3">
            {issues.map((f) => (
              <li key={f.key} className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                <p className="font-medium">✗ {f.title}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{f.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {good.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What you&apos;re already doing well</h2>
          <ul className="mt-3 space-y-2">
            {good.map((f) => (
              <li key={f.key} className="text-sm">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">✓ {f.title}.</span>{" "}
                <span className="text-zinc-600 dark:text-zinc-300">{f.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.quote.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Proposal</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {report.quote.map((q, i) => (
                <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4">{q.item}</td>
                  <td className="whitespace-nowrap py-2 text-right">{pkr(q.pricePkr)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total</td>
                <td className="whitespace-nowrap py-2 text-right">{pkr(total)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-10 flex flex-wrap gap-3 print:hidden">
        {reply && (
          <a href={reply} className="rounded-lg bg-[#25D366] px-5 py-3 font-medium text-white hover:brightness-95">
            Reply on WhatsApp
          </a>
        )}
        {sender.portfolio_url && /^https?:\/\//i.test(sender.portfolio_url) && (
          <a
            href={sender.portfolio_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-300 px-5 py-3 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            See previous work
          </a>
        )}
        {canPrint && <PrintButton />}
      </section>
      {sender.whatsapp && <p className="mt-4 hidden text-sm print:block">Contact: {sender.whatsapp}</p>}

      <footer className="mt-16 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 print:mt-8">
        This check-up looks only at public information: the business&apos;s website and Google listing.{" "}
        <a href={ref} className="underline print:no-underline">
          Made with LeadNama
        </a>
        .
      </footer>
    </main>
  );
}
