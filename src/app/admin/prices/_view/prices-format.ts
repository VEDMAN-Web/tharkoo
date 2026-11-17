/** Pure helpers for Prices & plans (H8.17), tested without a browser. */

/** "₹1,490": whole rupees with Indian grouping. */
export function rupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** "about ₹490" for a price in credits, from the credit price. */
export function aboutRupees(credits: number, creditPriceInr: number): string {
  return `about ${rupees(credits * creditPriceInr)}`;
}

export const creditsText = (count: number) => `${count.toLocaleString("en-IN")} ${count === 1 ? "credit" : "credits"}`;

/** The fee and credit price as typed, or what is wrong in plain words. */
export function checkNumbers(fee: string, price: string): { ok: true; fee: number; price: number } | { ok: false; feeError?: string; priceError?: string } {
  const feeValue = Number(fee.trim());
  const priceValue = Number(price.trim());
  const feeError = fee.trim() !== "" && Number.isInteger(feeValue) && feeValue >= 0 && feeValue <= 100_000 ? undefined : "Enter a whole number of credits, 0 or more.";
  const priceError = price.trim() !== "" && Number.isInteger(priceValue) && priceValue >= 1 && priceValue <= 100_000 ? undefined : "Enter a whole number of rupees, 1 or more.";
  if (feeError || priceError) return { ok: false, feeError, priceError };
  return { ok: true, fee: feeValue, price: priceValue };
}

/** A plan form as typed, or the first thing wrong. */
export function checkPlanForm(input: { name: string; description: string; amount: string; days: string; fixedLength: boolean; code: string }): string | null {
  if (input.name.trim().length < 1 || input.name.trim().length > 40) return "Give the plan a name of 1 to 40 characters.";
  if (input.description.trim().length < 1 || input.description.trim().length > 120) return "Write the line under the name, 120 characters at most.";
  const amount = Number(input.amount.trim());
  if (input.amount.trim() === "" || !Number.isInteger(amount) || amount < 0 || amount > 100_000) return "The price is a whole number of credits, 0 or more.";
  if (!input.fixedLength) {
    const days = Number(input.days.trim());
    if (input.days.trim() === "" || !Number.isInteger(days) || days < 1 || days > 365) return "Days is a whole number from 1 to 365.";
    if (input.code === "top" && ![1, 3, 7].includes(days)) return "TOP lasts 1, 3 or 7 days.";
  }
  return null;
}
