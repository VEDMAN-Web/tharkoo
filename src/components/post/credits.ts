"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/ui/api";

export const POST_FEE_DEFAULT = 0;
export const POSTING_FEE_PATH = "/api/wallet/posting-fee";
export const CREDIT_RUPEES = 10;
export const CREDITS_ADDED_EVENT = "tk:credits-added";
export const RECHARGE_PATH = "/u/account/credits/";

export function creditsText(count: number): string {
  return `${count} ${count === 1 ? "credit" : "credits"}`;
}

export function rupeesText(credits: number, price = CREDIT_RUPEES): string {
  return `Rs ${(credits * price).toLocaleString("en-IN")}`;
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

export function openRecharge({ shortfall }: { shortfall: number }) {
  const query = shortfall > 0 ? `?shortfall=${shortfall}` : "";
  window.location.href = `${RECHARGE_PATH}${query}`;
}

export function usePostingMoney() {
  const [fee, setFee] = useState(POST_FEE_DEFAULT);
  const [price, setPrice] = useState(CREDIT_RUPEES);
  const [balance, setBalance] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const res = await api<{ fee: number; balance: number; creditPriceInr?: number }>(POSTING_FEE_PATH);
    const charged = res.ok && Number(res.data?.fee) > 0;
    setFee(charged ? Number(res.data.fee) : 0);
    setBalance(charged ? Number(res.data.balance) : null);
    if (charged && typeof res.data.creditPriceInr === "number") setPrice(res.data.creditPriceInr);
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

  return { fee, price, paid: fee > 0, balance, ready, added, refresh };
}
