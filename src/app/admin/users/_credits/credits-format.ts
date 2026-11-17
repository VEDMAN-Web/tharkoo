/** Pure helpers for the credits dialog and tab (H8.14), so they are tested without a browser. */

export const MAX_CREDITS = 100_000;

export type CreditsStart = { mode: "add" | "remove"; amount: string };

export const creditWords = (count: number) => `${count.toLocaleString("en-IN")} ${count === 1 ? "credit" : "credits"}`;

/** Turns what was typed into a whole number of credits, or says what is wrong. */
export function amountProblem(text: string, mode: "add" | "remove", balance: number): { amount: number } | { error: string } {
  const clean = text.trim().replace(/,/g, "");
  if (!/^\d+$/.test(clean)) return { error: "Enter a whole number of credits, for example 50." };
  const amount = Number(clean);
  if (amount < 1 || amount > MAX_CREDITS) return { error: `Enter a number from 1 to ${MAX_CREDITS.toLocaleString("en-IN")}.` };
  if (mode === "remove" && amount > balance) return { error: `They have only ${creditWords(balance)}. You cannot remove more than that.` };
  return { amount };
}

/** "+50" or "-30" for a ledger line. */
export function signed(delta: number): string {
  return `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${Math.abs(delta).toLocaleString("en-IN")}`;
}
