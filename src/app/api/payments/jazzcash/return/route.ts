import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyResponse } from "@/lib/jazzcash";

/**
 * JazzCash POSTs the payment result here from the customer's browser.
 * We trust it only after checking the secure hash, the reference and the amount.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const back = (status: string) => NextResponse.redirect(new URL(`/billing?status=${status}`, url), 303);

  const form = await request.formData();
  const fields: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") fields[k] = v;
  });

  if (!verifyResponse(fields)) {
    console.error("JazzCash return: bad secure hash", fields.pp_TxnRefNo);
    return back("error");
  }

  const txnRef = fields.pp_TxnRefNo ?? "";
  const amountPkr = Number(fields.pp_Amount) / 100;
  const admin = createAdminClient();

  // 124: order placed, awaiting payment (e.g. voucher). Leave it pending.
  if (fields.pp_ResponseCode === "124") return back("pending");
  if (fields.pp_ResponseCode !== "000") {
    await admin
      .from("payments")
      .update({ status: "failed", provider_response: fields })
      .eq("txn_ref", txnRef)
      .eq("status", "pending");
    return back("failed");
  }

  const { data: ok, error } = await admin.rpc("fulfil_payment", {
    p_txn_ref: txnRef,
    p_amount: amountPkr,
    p_response: fields,
  });
  if (error) {
    console.error(error);
    return back("error");
  }
  // `false` means already fulfilled (a refresh or duplicate POST) or an amount mismatch.
  return back(ok ? "paid" : "already");
}
