"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSitePath } from "@/components/useSitePath";
import { api, hasSessionHint } from "@/lib/ui/api";

export type AccountUser = { displayName?: string; email?: string; verificationStatus?: string; roles?: string[] };
export type AccountPhase = "unknown" | "out" | "loading" | "ready";
export type AccountState = { phase: AccountPhase; user: AccountUser | null; balance: number | null; balanceReady: boolean; unread: number };

export const SESSION_EVENT = "tk:session-changed";
/** Same name as CREDITS_ADDED_EVENT in post/credits.ts: sent after a recharge, a publish or a promotion. */
export const CREDITS_CHANGED_EVENT = "tk:credits-added";

const IDLE: AccountState = { phase: "unknown", user: null, balance: null, balanceReady: false, unread: 0 };
/** H7.131: sent when chat messages arrive or are read, so the header unread badge refreshes. */
export const CHAT_ACTIVITY_EVENT = "tk:chat-activity";
const UNREAD_POLL_MS = 20000;

const AccountContext = createContext<AccountState>(IDLE);

export function AccountProvider({ children }: { children: ReactNode }) {
  const path = useSitePath();
  const [state, setState] = useState<AccountState>(IDLE);
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(() => {
    if (!hasSessionHint()) {
      setState((prev) => (prev.phase === "out" ? prev : { ...IDLE, phase: "out" }));
      return;
    }
    started.current = true;
    setState({ ...IDLE, phase: "loading" });
    api<{ user: AccountUser }>("/api/auth/me").then((res) => {
      if (!mounted.current) return;
      if (!res.ok) started.current = false;
      setState((prev) => (res.ok ? { ...prev, phase: "ready", user: res.data.user } : { ...prev, phase: "out" }));
    });
    api<{ balance: number }>("/api/wallet").then((res) => {
      if (!mounted.current) return;
      setState((prev) => ({ ...prev, balance: res.ok ? res.data.balance : null, balanceReady: true }));
    });
  }, []);

  useEffect(() => {
    if (started.current) return;
    const id = window.setTimeout(load, 0);
    return () => window.clearTimeout(id);
  }, [path, load]);

  useEffect(() => {
    function onSessionChange() {
      load();
    }
    window.addEventListener(SESSION_EVENT, onSessionChange);
    return () => window.removeEventListener(SESSION_EVENT, onSessionChange);
  }, [load]);

  useEffect(() => {
    // H7.120: after a publish, a promotion or a recharge the pill shows the real balance without a page change.
    function onCredits() {
      if (!hasSessionHint()) return;
      api<{ balance: number }>("/api/wallet").then((res) => {
        if (!mounted.current || !res.ok) return;
        setState((prev) => ({ ...prev, balance: res.data.balance, balanceReady: true }));
      });
    }
    window.addEventListener(CREDITS_CHANGED_EVENT, onCredits);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, onCredits);
  }, []);

  const signedInNow = state.phase === "ready";
  useEffect(() => {
    if (!signedInNow) return;
    function readUnread() {
      if (!hasSessionHint()) return;
      api<{ unread: number }>("/api/chat/unread").then((res) => {
        if (!mounted.current || !res.ok) return;
        const unread = Number(res.data.unread) || 0;
        setState((prev) => (prev.unread === unread ? prev : { ...prev, unread }));
      });
    }
    const first = window.setTimeout(readUnread, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") readUnread();
    }, UNREAD_POLL_MS);
    window.addEventListener(CHAT_ACTIVITY_EVENT, readUnread);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener(CHAT_ACTIVITY_EVENT, readUnread);
    };
  }, [signedInNow]);

  return <AccountContext.Provider value={state}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  return useContext(AccountContext);
}

export function isSignedInPhase(phase: AccountPhase) {
  return phase === "loading" || phase === "ready";
}
