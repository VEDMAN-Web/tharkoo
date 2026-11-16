"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bitcoin, CreditCard, ReceiptText } from "lucide-react";
import { api, hasSessionHint } from "@/lib/ui/api";
import { makeT } from "@/lib/ui/text";
import { methodLabel } from "@/components/recharge/labels";
import type { paymentView } from "@/server/billing/recharge";

/** H7.112: purchases and credits used, in the account panel. A table on desktop, one card per row on phones. */

type Purchase = ReturnType<typeof paymentView>;
type Entry = { id: string; delta: number; reason: string; refType?: string | null; balanceAfter?: number | null; createdAt: string | null };
type Tab = "purchases" | "used";

const t = makeT();

function dateOf(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "";
}

export function usedLabel(entry: Pick<Entry, "refType" | "reason">): string {
  if (entry.refType === "listing_fee") return t("history.used.listing");
  if (entry.reason === "refund") return t("history.used.refund");
  return t("history.used.other");
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="up-empty" data-tk="history-empty">
      <span className="up-empty-icon" aria-hidden="true"><ReceiptText size={30} /></span>
      <p className="up-empty-title">{title}</p>
      <p className="up-empty-body">{body}</p>
      <Link href="/u/account/credits/" className="up-btn">{t("history.open")}</Link>
    </div>
  );
}

function PurchaseTable({ rows }: { rows: Purchase[] }) {
  return (
    <table className="up-table up-hist" data-tk="purchase-history">
      <thead>
        <tr>
          <th scope="col">{t("history.when")}</th>
          <th scope="col">{t("history.method")}</th>
          <th scope="col">{t("history.amount")}</th>
          <th scope="col">{t("history.credits")}</th>
          <th scope="col">{t("history.status")}</th>
          <th scope="col"><span className="up-hist-sr">{t("history.receipt")}</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const Icon = row.method === "card" ? CreditCard : Bitcoin;
          return (
            <tr key={row.id} data-tk="purchase-row" data-status={row.status}>
              <td data-label={t("history.when")}>{dateOf(row.createdAt)}</td>
              <td data-label={t("history.method")}><span className="up-hist-method"><Icon size={16} aria-hidden="true" />{methodLabel(row)}</span></td>
              <td data-label={t("history.amount")}>{`₹${row.amount.toLocaleString("en-IN")}`}</td>
              <td data-label={t("history.credits")}>{row.credits.toLocaleString("en-IN")}</td>
              <td data-label={t("history.status")}><span className={`up-hist-pill up-hist-${row.status}`}>{t(`history.status.${row.status}` as "history.status.paid")}</span></td>
              <td className="up-hist-last"><Link href={`/u/account/credits/receipt/${row.id}/`} prefetch={false} className="up-link">{t("history.receipt")}</Link></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function UsedTable({ rows }: { rows: Entry[] }) {
  return (
    <table className="up-table up-hist" data-tk="used-history">
      <thead>
        <tr>
          <th scope="col">{t("history.when")}</th>
          <th scope="col">{t("history.what")}</th>
          <th scope="col">{t("history.credits")}</th>
          <th scope="col">{t("history.left")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} data-tk="used-row">
            <td data-label={t("history.when")}>{dateOf(row.createdAt)}</td>
            <td data-label={t("history.what")}>{usedLabel(row)}</td>
            <td data-label={t("history.credits")}>{`−${Math.abs(row.delta).toLocaleString("en-IN")}`}</td>
            <td data-label={t("history.left")}>{typeof row.balanceAfter === "number" ? row.balanceAfter.toLocaleString("en-IN") : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CreditsHistory() {
  const [tab, setTab] = useState<Tab>("purchases");
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [used, setUsed] = useState<Entry[] | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) {
        setPurchases([]);
        setUsed([]);
        return;
      }
      api<{ items: Purchase[] }>("/api/payments/history").then((res) => setPurchases(res.ok ? res.data.items : []));
      api<{ items: Entry[] }>("/api/wallet/entries").then((res) => setUsed(res.ok ? (res.data.items || []).filter((row) => row.delta < 0) : []));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "purchases", label: t("history.tab.purchases") },
    { key: "used", label: t("history.tab.used") },
  ];
  const rows = tab === "purchases" ? purchases : used;

  return (
    <section aria-labelledby="history-title" className="up-glass up-panel" data-tk="credits-history">
      <div className="up-panel-head">
        <h1 id="history-title" className="up-h2">{t("history.page")}</h1>
      </div>
      <div role="tablist" aria-label={t("history.page")} className="up-filters up-hist-tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`history-tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls="history-body"
            className={tab === item.key ? "up-filter-btn up-filter-on" : "up-filter-btn"}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="history-body" role="tabpanel" aria-labelledby={`history-tab-${tab}`} className="up-hist-body">
        {rows === null ? (
          <p className="up-muted" aria-live="polite">{t("history.loading")}</p>
        ) : rows.length === 0 ? (
          tab === "purchases" ? <Empty title={t("history.empty")} body={t("history.empty.body")} /> : <Empty title={t("history.used.empty")} body={t("history.used.empty.body")} />
        ) : tab === "purchases" ? (
          <PurchaseTable rows={rows as Purchase[]} />
        ) : (
          <UsedTable rows={rows as Entry[]} />
        )}
      </div>
    </section>
  );
}
