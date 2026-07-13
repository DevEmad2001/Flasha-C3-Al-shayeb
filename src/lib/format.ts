export const CURRENCY = "د.أ";

export function formatMoney(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY}`;
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export const DEFAULT_PAYMENT_METHODS = ["كاش", "تحويل بنكي", "شيك", "فيزا", "أخرى"] as const;

/** @deprecated استخدم usePaymentMethods() — القائمة تأتي من قاعدة البيانات */
export const PAYMENT_METHODS = DEFAULT_PAYMENT_METHODS;
