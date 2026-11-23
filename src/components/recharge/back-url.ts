/**
 * Where the checkout sends the person back to. A return page that carries `call=1` is an ad page whose video call pop-up was open
 * (H19.3): after a PAID payment it also gets `paid=1` and `added=<credits>`, which the pop-up reads to show "Recharge successful"
 * and to have the Start video call button ready. A failed or cancelled payment never carries them.
 */
export function callBackUrl(base: string, result: "paid" | "failed", credits: number, paymentId: string): string {
  const start = base || "/u/account/credits/";
  const joiner = start.includes("?") ? "&" : "?";
  const url = `${start}${joiner}recharge=${result}&credits=${credits}&payment=${paymentId}`;
  return result === "paid" && /[?&]call=1(&|$)/.test(start) ? `${url}&paid=1&added=${credits}` : url;
}
