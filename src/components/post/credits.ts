"use client";

import { useCallback, useEffect, useState } from "react";
import { api, hasSessionHint, type ApiError } from "@/lib/ui/api";
import { openRecharge } from "@/components/recharge/openRecharge";

/** H7.112: the same recharge sheet as the header and the credits page opens on a short balance. */
export { openRecharge };

export const POST_FEE_DEFAULT = 0;
export const POSTING_FEE_PATH = "/api/wallet/posting-fee";
export const CREDIT_RUPEES = 10;
export const CREDITS_ADDED_EVENT = "tk:credits-added";

export function creditsText(count: number): string {
  return `${count} ${count === 1 ? "credit" : "credits"}`;
}

export function rupeesText(credits: number, price = CREDIT_RUPEES): string {
  return `₹${(credits * price).toLocaleString("en-IN")}`;
}

export function shortfallOf(fee: number, balance: number | null): number {
  return balance === null ? 0 : Math.max(0, fee - balance);
}

export function insufficientFrom(error: ApiError | undefined, fee: number): { need: number; balance: number } | null {
  if (!error || error.code !== "INSUFFICIENT_CREDITS") return null;
  const raw = { ...(error.details ?? error.fields ?? {}), ...(error as Record<string, unknown>) } as Record<string, unknown>;
  const pick = (key: string) => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    const parsed = Number(first);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const balance = pick("balance") ?? 0;
  const need = pick("need") ?? fee;
  return { need, balance };
}


export function usePostingMoney() {
  const [fee, setFee] = useState(POST_FEE_DEFAULT);
  const [price, setPrice] = useState(CREDIT_RUPEES);
  const [balance, setBalance] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  /** H11.1b: posting costs credits for this site, and where this ad sits in the account's free ads. */
  const [paidOn, setPaidOn] = useState(false);
  const [place, setPlace] = useState<{ adNumber: number; freeAds: number } | null>(null);

  const refresh = useCallback(async () => {
    // H7.131: a visitor who is not signed in has no balance to ask for; asking would only log a 401 on every page that shows the post strip.
    if (!hasSessionHint()) {
      setReady(true);
      return;
    }
    const res = await api<{ fee: number; balance: number; creditPriceInr?: number; paidPostingOn?: boolean; free?: boolean; adNumber?: number; freeAds?: number }>(POSTING_FEE_PATH);
    const charged = res.ok && Number(res.data?.fee) > 0;
    // A site that charges for posting (an older answer without the flag counts as charging when the fee is above 0).
    const on = res.ok && (typeof res.data?.paidPostingOn === "boolean" ? res.data.paidPostingOn : charged);
    setPaidOn(on);
    setFee(charged ? Number(res.data.fee) : 0);
    setBalance(on ? Number(res.data.balance) : null);
    setPlace(on && res.ok && Number(res.data?.adNumber) > 0 && Number(res.data?.freeAds) > 0 ? { adNumber: Number(res.data.adNumber), freeAds: Number(res.data.freeAds) } : null);
    if (on && typeof res.data.creditPriceInr === "number") setPrice(res.data.creditPriceInr);
    setReady(true);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    function onAdded(event: Event) {
      const count = Number((event as CustomEvent<{ added?: number }>).detail?.added ?? 0);
      setAdded(count > 0 ? count : null);
      void refresh();
    }
    window.addEventListener(CREDITS_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(CREDITS_ADDED_EVENT, onAdded);
  }, [refresh]);

  useEffect(() => {
    if (added === null) return;
    const id = window.setTimeout(() => setAdded(null), 5000);
    return () => window.clearTimeout(id);
  }, [added]);

  return { fee, price, paid: fee > 0, paidOn, free: paidOn && fee === 0, place, balance, ready, added, refresh };
}
