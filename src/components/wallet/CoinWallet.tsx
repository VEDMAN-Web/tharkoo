"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { CreditPacksPanel } from "@/components/recharge/CreditPacks";
import { rupees } from "@/lib/credit-pack-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorEarnings } from "@/components/wallet/VendorEarnings";
import { dateTime, inr, STATUS_LABEL, statusTone } from "@/components/wallet/format";

interface CoinsResponse {
  balance: number;
  coinValueInr: number;
}

interface Purchase {
  id: string;
  coins: number;
  amount: number;
  status: string;
  tdsPercent: number;
  gstPercent: number;
  createdAt: string | null;
}

interface Movement {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: string | null;
}

type Tab = "buy" | "earnings" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "buy", label: "Buy credits" },
  { key: "earnings", label: "Earnings" },
  { key: "history", label: "History" },
];

/** The Earnings tab shows only for an account that has earnings (H9.1). */
export const tabsFor = (hasEarnings: boolean) => TABS.filter((item) => item.key !== "earnings" || hasEarnings);

function Balance({ balance, coinValueInr }: { balance: number; coinValueInr: number }) {
  return (
    <section
      aria-label="Credit balance"
      style={{
        borderRadius: 16,
        padding: "20px 18px",
        color: "#2b2110",
        background: "linear-gradient(135deg, #fdf0f7 0%, #f5b5d6 45%, #e91e8c 100%)",
        boxShadow: "0 8px 24px rgba(138, 100, 22, 0.18)",
      }}
    >
      <p className="t-small" style={{ margin: 0, opacity: 0.8 }}>Credit balance</p>
      <p style={{ margin: "4px 0 0", fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{balance} credits</p>
      <p className="t-small" style={{ margin: "6px 0 0" }}>About {rupees(balance * coinValueInr)} in value</p>
    </section>
  );
}

function HistoryTab() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      api<{ items: Purchase[] }>("/api/wallet/coins/purchases?page=1&pageSize=20").then((res) => setPurchases(res.ok ? res.data.items : []));
      api<{ items: Movement[] }>("/api/wallet/entries?page=1&pageSize=20").then((res) => setMovements(res.ok ? res.data.items : []));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!purchases || !movements) return <p className="t-small" style={{ color: "var(--muted)" }}>Loading history</p>;
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section aria-label="Purchases" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Purchases</h2>
        {purchases.length === 0 ? <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>No purchases yet.</p> : null}
        {purchases.map((row) => (
          <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span>
              <strong>{row.coins} credits</strong> <span className="t-small" style={{ color: "var(--muted)" }}>{dateTime(row.createdAt)}</span>
            </span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="t-small">{inr(row.amount)} · TDS {row.tdsPercent}% · GST {row.gstPercent}%</span>
              <span style={{ ...statusTone(row.status), borderRadius: 999, padding: "2px 10px", fontSize: 13 }}>{STATUS_LABEL[row.status] ?? row.status}</span>
            </span>
          </div>
        ))}
      </section>
      <section aria-label="Credit movements" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Credit movements</h2>
        {movements.length === 0 ? <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>No movements yet.</p> : null}
        {movements.map((row) => (
          <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span className="t-small">{row.reason} · {dateTime(row.createdAt)}</span>
            <span>
              <strong style={{ color: row.delta < 0 ? "var(--danger, #a12626)" : "var(--ok, #1f7a3a)" }}>{row.delta > 0 ? `+${row.delta}` : row.delta}</strong>{" "}
              <span className="t-small" style={{ color: "var(--muted)" }}>bal {row.balanceAfter}</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

export function CoinWallet({ initialTab = "buy", hasEarnings = false }: { initialTab?: Tab; hasEarnings?: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab === "earnings" && !hasEarnings ? "buy" : initialTab);
  const [data, setData] = useState<CoinsResponse | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const signOut = useCallback(() => setSignedOut(true), []);

  const load = useCallback(async () => {
    const res = await api<CoinsResponse>("/api/wallet/coins");
    if (res.ok) return setData(res.data);
    if (res.status === 401) return setSignedOut(true);
    setError(friendlyError(res.error));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) return setSignedOut(true);
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  if (signedOut) {
    return (
      <EmptyState
        title="Sign in to see your wallet"
        body="Your credit balance and earnings load after you log in."
        action={{ href: "/u/login/?next=/u/account/wallet/", label: "Log in" }}
      />
    );
  }
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {error ? <p className="t-small" role="alert" style={{ color: "var(--danger, #a12626)" }}>{error}</p> : null}
      {data ? <Balance balance={data.balance} coinValueInr={data.coinValueInr} /> : <p className="t-small" style={{ color: "var(--muted)" }}>Loading balance</p>}
      <nav aria-label="Wallet sections" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {tabsFor(hasEarnings).map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
            className={tab === item.key ? "tk-btn tk-btn-cta" : "tk-btn tk-btn-outline-primary"}
            style={{ flex: "1 0 auto" }}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === "buy" ? <CreditPacksPanel returnTo="/u/account/wallet/" /> : null}
      {tab === "earnings" ? <VendorEarnings onSignedOut={signOut} /> : null}
      {tab === "history" ? <HistoryTab /> : null}
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>
        Need help with a payment? <Link href="/u/account/credits/history/" style={{ color: "var(--accent)" }}>See older transactions</Link>
      </p>
    </div>
  );
}
