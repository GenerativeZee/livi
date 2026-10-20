/**
 * Normalises what people type for an Indian mobile number to E.164 ("+919876543210").
 * Accepts spaces, dashes, and a leading 0, 91 or +91. Returns null for anything that
 * isn't a 10-digit mobile number starting with 6–9.
 */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" → "+91 98765 43210" */
export function formatIndianPhone(e164: string): string {
  const local = e164.replace(/^\+91/, "");
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}
