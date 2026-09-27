import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { jazzcashConfigured } from "@/lib/jazzcash";
import { PACKS, PLANS, type Plan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

const STATUS: Record<string, { text: string; ok: boolean }> = {
  paid: { text: "Payment received. Thank you! Your account has been updated.", ok: true },
  already: { text: "This payment was already processed.", ok: true },
  pending: { text: "Your payment is pending. We'll update your account once JazzCash confirms it.", ok: true },
  failed: { text: "The payment didn't go through. You haven't been charged.", ok: false },
  error: { text: "Something went wrong with the payment. If money was deducted, contact support with your JazzCash reference.", ok: false },
  invalid: { text: "Unknown product.", ok: false },
  unavailable: { text: "Online payments aren't set up yet.", ok: false },
};

function pkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

function date(iso: string) {
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/billing");

  const [{ data: profile }, workspace] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).single(),
    getWorkspace(supabase, user.id),
  ]);
  if (!workspace) redirect("/onboarding");

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, method, status, product, created_at, txn_ref")
    .eq("workspace_id", workspace.id)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  const payable = jazzcashConfigured();
  const notice = typeof status === "string" ? STATUS[status] : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader name={profile?.name ?? user.email ?? ""} active="/billing" />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
        <h1 className="text-2xl font-bold">Billing</h1>

        {notice && (
          <p
            className={`rounded-md p-3 text-sm ${
              notice.ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {notice.text}
          </p>
        )}

        <section className="grid gap-4 rounded-xl border border-zinc-200 p-5 sm:grid-cols-3 dark:border-zinc-800">
          <Stat label="Plan" value={PLANS[workspace.plan].name} sub={workspace.plan_expires_at ? `Until ${date(workspace.plan_expires_at)}` : undefined} />
          <Stat label="Monthly credits left" value={String(workspace.credits_left)} sub={`Resets ${date(workspace.credits_reset_at)}`} />
          <Stat label="Pack credits" value={String(workspace.bonus_credits)} sub="Never expire" />
        </section>

        <section>
          <h2 className="text-lg font-semibold">Plans</h2>
          <p className="text-sm text-zinc-500">30 days per payment. No auto-renewal, no card needed.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(Object.keys(PLANS) as Plan[]).map((id) => (
              <div key={id} className={`rounded-xl border p-5 ${workspace.plan === id ? "border-emerald-600" : "border-zinc-200 dark:border-zinc-800"}`}>
                <h3 className="font-semibold">{PLANS[id].name}</h3>
                <p className="mt-1 text-2xl font-bold">{PLANS[id].pricePkr ? pkr(PLANS[id].pricePkr) : "Free"}</p>
                <p className="mt-2 text-sm text-zinc-500">{PLANS[id].leads.toLocaleString()} leads / month · {PLANS[id].blurb}</p>
                {id !== "free" && (
                  <BuyButton product={id} disabled={!payable} label={workspace.plan === id ? "Renew 30 days" : "Upgrade"} />
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Credit packs</h2>
          <p className="text-sm text-zinc-500">Pay as you go. Pack credits are used after your monthly credits and never expire.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {PACKS.map((p) => (
              <div key={p.id} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
                <h3 className="font-semibold">{p.credits} leads</h3>
                <p className="mt-1 text-2xl font-bold">{pkr(p.pricePkr)}</p>
                <BuyButton product={p.id} disabled={!payable} label="Buy" />
              </div>
            ))}
          </div>
        </section>

        <p className="text-sm text-zinc-500">
          {payable
            ? "You'll pay on JazzCash's secure page with a JazzCash wallet or any debit/credit card. Easypaisa wallet payments are coming soon."
            : "Online payments aren't set up yet."}
        </p>

        {payments && payments.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">Payment history</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Item</th>
                  <th className="py-1 font-medium">Amount</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-1.5">{date(p.created_at)}</td>
                    <td className="py-1.5 capitalize">{p.product.replace("pack_", "") + (p.product.startsWith("pack_") ? " leads" : " plan")}</td>
                    <td className="py-1.5">{pkr(p.amount)}</td>
                    <td className="py-1.5 capitalize">{p.status}</td>
                    <td className="py-1.5 font-mono text-xs">{p.txn_ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function BuyButton({ product, label, disabled }: { product: string; label: string; disabled: boolean }) {
  return (
    <form action="/api/payments/jazzcash/checkout" method="post" className="mt-4">
      <input type="hidden" name="product" value={product} />
      <button
        disabled={disabled}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {label}
      </button>
    </form>
  );
}
