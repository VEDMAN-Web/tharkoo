"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api, hasSessionHint } from "@/lib/ui/api";

export type AccountUser = { displayName?: string; email?: string; verificationStatus?: string; roles?: string[] };
export type AccountPhase = "unknown" | "out" | "loading" | "ready";
export type AccountState = { phase: AccountPhase; user: AccountUser | null; balance: number | null; balanceReady: boolean };

export const SESSION_EVENT = "tk:session-changed";

const IDLE: AccountState = { phase: "unknown", user: null, balance: null, balanceReady: false };

const AccountContext = createContext<AccountState>(IDLE);

export function AccountProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
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

  return <AccountContext.Provider value={state}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  return useContext(AccountContext);
}

export function isSignedInPhase(phase: AccountPhase) {
  return phase === "loading" || phase === "ready";
}
