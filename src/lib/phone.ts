/** Digits-only international form for Pakistani numbers, e.g. "0300 1234567" → "923001234567". */
export function toInternationalDigits(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0092")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return digits.length >= 10 ? digits : null;
}

/** Pakistani mobiles (+92 3xx) are the ones likely to be on WhatsApp; landlines are not. */
export function whatsappUrl(phone: string | null, text: string): string | null {
  if (!phone) return null;
  const digits = toInternationalDigits(phone);
  if (!digits || !/^923\d{9}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
