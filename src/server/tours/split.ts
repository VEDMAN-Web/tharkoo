/** H19.10: what the vendor and Tharkoo each get from a paid video call. Whole credits only: the vendor's part is rounded down. */
export const TOUR_MIN_PRICE_COINS = 10;
export const CALL_SHARE_DEFAULT = 30;
export const CALL_SHARE_MAX = 90;

export function splitCall(price: number, feePercent: number): { vendor: number; fee: number } {
  const percent = Number.isFinite(feePercent) ? Math.min(CALL_SHARE_MAX, Math.max(0, Math.floor(feePercent))) : 0;
  const vendor = Math.floor((price * (100 - percent)) / 100);
  return { vendor, fee: price - vendor };
}
