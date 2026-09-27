import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * JazzCash hosted checkout ("Page Redirection", API v1.1).
 * The customer pays on JazzCash's page with a JazzCash wallet or a debit/credit card,
 * then JazzCash POSTs the result to our return URL.
 *
 * Verify every field name against the merchant integration guide you receive from
 * JazzCash and test end-to-end in their sandbox before going live.
 */

const URLS = {
  sandbox: "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/",
  production: "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/",
};

function config() {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID;
  const password = process.env.JAZZCASH_PASSWORD;
  const salt = process.env.JAZZCASH_INTEGRITY_SALT;
  if (!merchantId || !password || !salt) return null;
  return {
    merchantId,
    password,
    salt,
    url: process.env.JAZZCASH_ENV === "production" ? URLS.production : URLS.sandbox,
  };
}

export function jazzcashConfigured() {
  return config() !== null;
}

/** JazzCash wants Pakistan time as yyyyMMddHHmmss. */
function pktStamp(date: Date) {
  const pkt = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return pkt.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

/**
 * pp_SecureHash: HMAC-SHA256 (key = integrity salt) over the salt followed by every
 * non-empty pp_* / ppmpf_* value, ordered by field name, joined with "&". Uppercase hex.
 */
export function secureHash(fields: Record<string, string>, salt: string) {
  const values = Object.keys(fields)
    .filter((k) => /^(pp_|ppmpf_)/i.test(k) && k.toLowerCase() !== "pp_securehash" && fields[k] !== "")
    .sort()
    .map((k) => fields[k]);
  return createHmac("sha256", salt).update([salt, ...values].join("&")).digest("hex").toUpperCase();
}

export function newTxnRef() {
  // Max 20 chars, must be unique per merchant.
  return `LN${pktStamp(new Date())}${randomBytes(2).toString("hex").toUpperCase()}`;
}

export function checkoutForm(opts: { txnRef: string; amountPkr: number; description: string; returnUrl: string }) {
  const cfg = config();
  if (!cfg) throw new Error("JazzCash is not configured");
  const now = new Date();
  const fields: Record<string, string> = {
    pp_Version: "1.1",
    pp_TxnType: "", // empty: the customer chooses wallet or card on JazzCash's page
    pp_Language: "EN",
    pp_MerchantID: cfg.merchantId,
    pp_SubMerchantID: "",
    pp_Password: cfg.password,
    pp_BankID: "",
    pp_ProductID: "",
    pp_TxnRefNo: opts.txnRef,
    pp_Amount: String(Math.round(opts.amountPkr * 100)), // in paisa
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: pktStamp(now),
    pp_BillReference: opts.txnRef,
    pp_Description: opts.description.replace(/[^\w\s.,-]/g, "").slice(0, 100),
    pp_TxnExpiryDateTime: pktStamp(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    pp_ReturnURL: opts.returnUrl,
    ppmpf_1: "",
    ppmpf_2: "",
    ppmpf_3: "",
    ppmpf_4: "",
    ppmpf_5: "",
  };
  fields.pp_SecureHash = secureHash(fields, cfg.salt);
  return { action: cfg.url, fields };
}

/** Check the hash on JazzCash's POST to the return URL. */
export function verifyResponse(fields: Record<string, string>): boolean {
  const cfg = config();
  const given = fields.pp_SecureHash ?? "";
  if (!cfg || !given) return false;
  const expected = Buffer.from(secureHash(fields, cfg.salt));
  const actual = Buffer.from(given.toUpperCase());
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
