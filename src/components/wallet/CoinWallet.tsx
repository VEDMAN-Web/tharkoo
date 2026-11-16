"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyError, hasSessionHint, idempotencyKey } from "@/lib/ui/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorEarnings } from "@/components/wallet/VendorEarnings";
import { dateTime, inr, STATUS_LABEL, statusTone } from "@/components/wallet/format";
import { makeT } from "@/lib/ui/text";

interface Pack {
  id: string;
  coins: number;
  price: number;
  tag: string | null;
}

interface CoinsResponse {
  balance: number;
  coinValueInr: number;
  packs: Pack[];
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
const t = makeT();

const TABS: { key: Tab; label: string }[] = [
  { key: "buy", label: t("panel.coins.buy") },
  { key: "earnings", label: "Earnings" },
  { key: "history", label: "History" },
];

const HELD = "The payment provider is not connected yet. No money was taken and no coins were added.";

function Balance({ balance, coinValueInr }: { balance: number; coinValueInr: number }) {
  return (
    <section aria-labelledby="wallet-balance" className="up-coins-card">
      <h2 id="wallet-balance" className="up-coins-label">{t("panel.coins.title")}</h2>
      <p className="up-coins-value" data-tk="coin-balance">{t("panel.coins.balance", { count: balance })}</p>
      <p className="up-coins-worth" style={{ marginBottom: 0 }}>About {inr(balance * coinValueInr)} in value</p>
    </section>
  );
}

function BuyTab({ data }: { data: CoinsResponse }) {
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pack = data.packs.find((item) => item.id === selected);

  async function buy() {
    if (!pack) return;
    setBusy(true);
    setMessage("");
    const res = await api<{ checkoutUrl: string | null }>("/api/wallet/coins/checkout", {
      method: "POST",
      body: JSON.stringify({ packId: pack.id, idempotencyKey: idempotencyKey(`coins-${pack.id}`) }),
    });
    setBusy(false);
    if (!res.ok) return setMessage(friendlyError(res.error));
    if (res.data.checkoutUrl) {
      window.location.assign(res.data.checkoutUrl);
      return;
    }
    setMessage(HELD);
  }

  if (data.packs.length === 0) {
    return <p className="up-muted">No coin packs are on sale right now.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div role="radiogroup" aria-label="Coin packs" className="up-packs">
        {data.packs.map((item) => {
          const on = item.id === selected;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSelected(item.id)}
              className={on ? "up-pack up-pack-on" : "up-pack"}
            >
              {item.tag ? <span className="up-pack-tag">{item.tag.replace(/extra credits/i, "Extra coins")}</span> : null}
              <span className="up-pack-coins">{item.coins}</span>
              <span className="up-pack-unit">coins</span>
              <span className="up-pack-price">{inr(item.price)}</span>
            </button>
          );
        })}
      </div>
      <div className="up-pay-row">
        <p aria-live="polite" className="up-muted" style={{ color: message === HELD ? undefined : "#9f1239" }}>{message}</p>
        <button type="button" className="up-btn" disabled={!pack || busy} onClick={buy}>
          {pack ? `Pay ${inr(pack.price)}` : "Choose a pack"}
        </button>
      </div>
    </div>
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

  if (!purchases || !movements) return <div className="up-skeleton" aria-hidden="true" />;
  return (
    <div style={{ display: "grid", gap: 22 }}>
      <section aria-label="Purchases" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Purchases</h2>
        {purchases.length === 0 ? <p className="t-small" style={{ color: "var(--muted)", margin: 0 }}>No purchases yet.</p> : null}
        {purchases.map((row) => (
          <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <span>
              <strong>{row.coins} coins</strong> <span className="t-small" style={{ color: "var(--muted)" }}>{dateTime(row.createdAt)}</span>
            </span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="t-small">{inr(row.amount)} · TDS {row.tdsPercent}% · GST {row.gstPercent}%</span>
              <span style={{ ...statusTone(row.status), borderRadius: 999, padding: "2px 10px", fontSize: 13 }}>{STATUS_LABEL[row.status] ?? row.status}</span>
            </span>
          </div>
        ))}
      </section>
      <section aria-label="Coin movements" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Coin movements</h2>
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

export function CoinWallet({ initialTab = "buy" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
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
        body="Your coin balance and earnings load after you log in."
        action={{ href: "/u/login/?next=/u/account/wallet/", label: "Log in" }}
      />
    );
  }
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <h1 className="up-h2">Wallet</h1>
      {error ? <p className="up-error" role="alert">{error}</p> : null}
      {data ? <Balance balance={data.balance} coinValueInr={data.coinValueInr} /> : <div className="up-skeleton" aria-hidden="true" style={{ minHeight: 120 }} />}
      <nav aria-label="Wallet sections" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={tab === item.key}
            onClick={() => setTab(item.key)}
            className={tab === item.key ? "up-filter-btn up-filter-on" : "up-filter-btn"}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === "buy" && data ? <BuyTab data={data} /> : null}
      {tab === "earnings" ? <VendorEarnings onSignedOut={signOut} /> : null}
      {tab === "history" ? <HistoryTab /> : null}
      <p className="up-muted">
        Need help with a payment? <Link href="/u/account/credits/history/" className="up-link">See older transactions</Link>
      </p>
    </div>
  );
}
