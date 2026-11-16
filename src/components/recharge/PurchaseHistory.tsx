"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/ui/AdCard";
import { api, hasSessionHint } from "@/lib/ui/api";
import type { paymentView } from "@/server/billing/recharge";
import { methodLabel } from "./labels";

type Row = ReturnType<typeof paymentView>;

export function PurchaseHistory() {
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!hasSessionHint()) return setRows([]);
      api<{ items: Row[] }>("/api/payments/history").then((res) => setRows(res.ok ? res.data.items : []));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  if (rows === null) return null;
  return (
    <section aria-labelledby="purchases-title" data-tk="purchase-history" style={{ marginBottom: 24 }}>
      <h2 id="purchases-title" className="t-h3">{t("history.title")}</h2>
      {rows.length === 0 ? (
        <p className="t-small text-muted">{t("history.empty")}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-left t-small">
            <thead>
              <tr>
                <th scope="col">{t("history.when")}</th>
                <th scope="col">{t("history.method")}</th>
                <th scope="col">{t("history.amount")}</th>
                <th scope="col">{t("history.credits")}</th>
                <th scope="col">{t("history.status")}</th>
                <th scope="col">{t("history.receipt")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-tk="purchase-row" data-status={row.status}>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-IN") : ""}</td>
                  <td>{methodLabel(row)}</td>
                  <td>Rs {row.amount.toLocaleString("en-IN")}</td>
                  <td>{row.credits.toLocaleString("en-IN")}</td>
                  <td>{t(`history.status.${row.status}` as "history.status.paid")}</td>
                  <td>
                    <Link href={`/u/account/credits/receipt/${row.id}/`} prefetch={false}>{t("history.receipt")}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
