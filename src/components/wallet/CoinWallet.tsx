"use client";

import { useCallback, useEffect, useState } from "react";
import { CREDITS_CHANGED_EVENT, useAccount } from "@/components/account/AccountContext";
import Link from "next/link";
import { api, friendlyError, hasSessionHint } from "@/lib/ui/api";
import { CreditPacksPanel } from "@/components/recharge/CreditPacks";
import { rupees } from "@/lib/credit-pack-view";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorEarnings } from "@/components/wallet/VendorEarnings";
import { dateTime, inr, STATUS_LABEL, statusTone } from "@/components/wallet/format";
import { SkRows, SkStats } from "@/components/ui/Sk";

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

/** H18.8: three balances, kept apart: call credits (video calls), ad credits (posting, TOP, Super Top) and earnings. */
function Balance({ balance, coinValueInr }: { balance: number; coinValueInr: number }) {
  const { callBalance, earnings } = useAccount();
  const tiles = [
    { key: "call", label: "Call credits", value: callBalance ?? 0, note: "For video calls only" },
    { key: "ad", label: "Ad credits", value: balance, note: "For posting, TOP and Super Top" },
    { key: "earned", label: "Earnings", value: earnings ?? 0, note: "From your video calls. Withdraw or move to ad credits" },
  ];
  return (
    <section aria-label="Your balances" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
      {tiles.map((tile) => (
        <div
          key={tile.key}
          data-tk={`balance-${tile.key}`}
          style={{ borderRadius: 16, padding: "16px 16px", color: "#2b2110", background: tile.key === "ad" ? "linear-gradient(135deg, #fdf0f7 0%, #f5b5d6 100%)" : "#fdf0f7", border: "1px solid #ead8f0" }}
        >
          <p className="t-small" style={{ margin: 0, opacity: 0.85, fontWeight: 700 }}>{tile.label}</p>
          <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{tile.value.toLocaleString("en-IN")}</p>
          <p className="t-small" style={{ margin: "6px 0 0" }}>{tile.note}</p>
          {tile.key !== "call" ? <p className="t-small" style={{ margin: "2px 0 0", opacity: 0.8 }}>About {rupees(tile.value * coinValueInr)}</p> : null}
        </div>
      ))}
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

  if (!purchases || !movements) return <SkRows label="Loading history" rows={4} thumb={false} />;
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
  // The three balances above are read once per page. Ask for them again when the tab changes and every 15 seconds while the page is in view,
  // so a call that just paid out shows without a reload.
  useEffect(() => {
    if (!hasSessionHint()) return;
    const refresh = () => {
      if (document.visibilityState === "visible") window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(timer);
  }, [tab]);
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
      {data ? <Balance balance={data.balance} coinValueInr={data.coinValueInr} /> : <SkStats label="Loading balance" />}
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
      {tab === "buy" ? <CreditPacksPanel returnTo="/u/account/wallet/" withPrices /> : null}
      {tab === "earnings" ? <VendorEarnings onSignedOut={signOut} /> : null}
      {tab === "history" ? <HistoryTab /> : null}
      <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>
        Need help with a payment? <Link href="/u/account/credits/history/" style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", minHeight: 24 }}>See older transactions</Link>
      </p>
    </div>
  );
}
