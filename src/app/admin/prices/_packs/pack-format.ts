/** Pure helpers for the recharge packs table (H8.20). */

/** "₹9.05": rupees per credit with two decimals. */
export function perCreditText(value: number): string {
  return `₹${value.toFixed(2)}`;
}

/** "200 credits + 10 free", or "100 credits" with no free credits. */
export function packText(credits: number, bonus: number): string {
  const base = `${credits.toLocaleString("en-IN")} ${credits === 1 ? "credit" : "credits"}`;
  return bonus > 0 ? `${base} + ${bonus.toLocaleString("en-IN")} free` : base;
}

/** A pack form as typed, or the first thing wrong. */
export function checkPackForm(input: { credits: string; bonus: string; price: string }): string | null {
  const whole = (text: string, min: number, max: number) => text.trim() !== "" && Number.isInteger(Number(text.trim())) && Number(text.trim()) >= min && Number(text.trim()) <= max;
  if (!whole(input.credits, 1, 1_000_000)) return "Credits is a whole number from 1 to 1,000,000.";
  if (!whole(input.bonus || "0", 0, 1_000_000)) return "Free credits is a whole number from 0 to 1,000,000.";
  if (!whole(input.price, 1, 10_000_000)) return "The price is a whole number of rupees, 1 or more.";
  return null;
}
