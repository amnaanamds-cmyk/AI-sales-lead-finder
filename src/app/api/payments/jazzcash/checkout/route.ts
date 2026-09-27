import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutForm, jazzcashConfigured, newTxnRef } from "@/lib/jazzcash";
import { productPrice } from "@/lib/plans";
import { getWorkspace } from "@/lib/workspace";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Creates a pending payment and returns a page that auto-submits to JazzCash's hosted checkout. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const back = (status: string) => NextResponse.redirect(new URL(`/billing?status=${status}`, url), 303);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/billing", url), 303);
  if (!jazzcashConfigured()) return back("unavailable");

  const form = await request.formData();
  const product = String(form.get("product") ?? "");
  const price = productPrice(product);
  const workspace = await getWorkspace(supabase, user.id);
  if (!price || !workspace) return back("invalid");

  const txnRef = newTxnRef();
  // Payments are written with the service role: users can read theirs but never create or edit them.
  const { error } = await createAdminClient().from("payments").insert({
    workspace_id: workspace.id,
    amount: price.pricePkr,
    method: "jazzcash",
    status: "pending",
    product,
    txn_ref: txnRef,
  });
  if (error) {
    console.error(error);
    return back("error");
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  const { action, fields } = checkoutForm({
    txnRef,
    amountPkr: price.pricePkr,
    description: price.label,
    returnUrl: `${site}/api/payments/jazzcash/return`,
  });

  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting to JazzCash…</title></head>
<body style="font-family:system-ui;padding:2rem;text-align:center">
<p>Redirecting you to JazzCash to pay PKR ${price.pricePkr.toLocaleString("en-PK")}…</p>
<form id="f" method="post" action="${escapeHtml(action)}">${inputs}<noscript><button>Continue</button></noscript></form>
<script>document.getElementById("f").submit()</script></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
