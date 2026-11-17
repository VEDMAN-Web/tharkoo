"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, SearchX } from "lucide-react";
import { Badge, Button, Drawer, FilterBar, KpiCard, Notice, PageHeader, ServerTable, Tabs, ToastProvider, type TableColumn } from "@/components/admin/ui";
import { OrderActions } from "@/app/admin/finance/_actions/OrderActions";
import { BlockedRefunds, type BlockedRefundRow } from "@/app/admin/finance/BlockedRefunds";
import { PayoutsQueue, type PayoutRow } from "@/app/admin/finance/PayoutsQueue";
import { TaxSettingsForm } from "@/app/admin/finance/TaxSettingsForm";
import { dateLabel } from "@/app/admin/users/_list/format";
import type { OrderList, OrderRow, OrderTab } from "@/server/admin/orders";
import { kpiTexts, rangeLabel, statusLabel } from "./orders-format";
import "./orders.css";

const TAB_LABELS: Record<OrderTab, string> = { recharges: "Recharges", fees: "Posting fees", promotions: "Promotions", refunds: "Refunds", payouts: "Payouts", wallet: "Wallet changes" };
const SEARCH_DEBOUNCE_MS = 350;

type TaxSettings = Parameters<typeof TaxSettingsForm>[0]["initial"];
export type PayoutsPart = { canFinance: boolean; rows: PayoutRow[]; settings: TaxSettings | null };

/** Orders & credits (H8.22), read only: four numbers, six tabs, search and filters kept in the address, a table and a drawer. Test orders carry TEST and are left out of sales. */
export function OrdersView({ list, payouts, blocked }: { list: OrderList; payouts: PayoutsPart; blocked: BlockedRefundRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { query, kpis } = list;
  const [search, setSearch] = useState(query.q);
  const sentSearch = useRef(query.q);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const text = next.toString();
    router.push(`${pathname}${text ? `?${text}` : ""}`, { scroll: false });
  }

  useEffect(() => {
    if (search.trim() === sentSearch.current) return;
    const id = window.setTimeout(() => {
      sentSearch.current = search.trim();
      go({ q: search.trim() || null, page: null, open: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const now = new Date();
  const texts = kpiTexts(kpis);
  const open = list.rows.find((row) => row.id === query.open) ?? null;
  const columns: TableColumn<OrderRow>[] = [
    {
      key: "order",
      header: "Order",
      primary: true,
      cell: (row) => (
        <>
          <strong>{row.ref}</strong>
          <small>{row.sub}</small>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <span className="adm-o-badges">
          {row.test ? <Badge tone="warn">TEST</Badge> : null}
          <Badge tone={row.statusTone}>{row.statusText}</Badge>
        </span>
      ),
    },
    { key: "amount", header: "Amount", nowrap: true, cell: (row) => row.amount },
    { key: "user", header: "User", hideOnPhone: true, cell: (row) => row.who },
    { key: "time", header: "Time", nowrap: true, cell: (row) => dateLabel(row.at, now) },
  ];

  const chips = [
    ...(query.range !== "all" ? [{ key: "range", label: rangeLabel(query.range) }] : []),
    ...(query.status ? [{ key: "status", label: "Status", value: statusLabel(query.status) }] : []),
    ...(query.hideTest ? [{ key: "test", label: "Hide test orders" }] : []),
  ];
  const addable = [
    ...(query.range !== "7" ? [{ key: "range7", label: "Last 7 days" }] : []),
    ...(query.range !== "30" ? [{ key: "range30", label: "Last 30 days" }] : []),
    ...(query.range !== "all" ? [{ key: "rangeAll", label: "All time" }] : []),
    ...(query.tab === "recharges" && !query.status ? [{ key: "pending", label: "Waiting" }, { key: "paid", label: "Paid" }, { key: "failed", label: "Failed" }] : []),
    ...(query.tab === "recharges" && !query.hideTest ? [{ key: "test", label: "Hide test orders" }] : []),
  ];

  function onAdd(key: string) {
    if (key === "range7") go({ range: "7", page: null });
    else if (key === "range30") go({ range: null, page: null });
    else if (key === "rangeAll") go({ range: "all", page: null });
    else if (key === "test") go({ test: "hide", page: null });
    else go({ status: key, page: null });
  }

  function onRemove(key: string) {
    if (key === "range") go({ range: "all", page: null });
    else if (key === "status") go({ status: null, page: null });
    else go({ test: null, page: null });
  }

  const searching = query.q !== "";
  return (
    <ToastProvider>
    <div className="adm-k" data-tk="orders-screen">
      <PageHeader
        crumbs={[{ label: "Money" }]}
        title="Orders & credits"
        purpose="Every payment and wallet change. Test orders carry a TEST badge and are left out of sales."
      />
      <div className="adm-o-kpis" data-tk="orders-kpis">
        <KpiCard label="Real sales today" value={texts.sales.value} hint={texts.sales.hint} />
        <KpiCard label="Test orders today" value={texts.test.value} hint={texts.test.hint} />
        <KpiCard label="Recharges to check" value={texts.check.value} hint={texts.check.hint} />
        <KpiCard label="Payouts to approve" value={texts.payouts.value} hint={texts.payouts.hint} />
      </div>
      <div className="adm-card adm-o-flat">
        <Tabs
          idPrefix="orders"
          label="Orders and credits"
          active={query.tab}
          items={(Object.keys(TAB_LABELS) as OrderTab[]).map((key) => ({ key, label: TAB_LABELS[key], count: key === "recharges" ? kpis.toCheck.count || undefined : key === "payouts" ? kpis.payouts.count || undefined : undefined }))}
          onChange={(key) => go({ tab: key === "recharges" ? null : key, page: null, open: null, q: null, status: null })}
        />
        <div role="tabpanel" id={`orders-panel-${query.tab}`} aria-labelledby={`orders-${query.tab}`}>
          {query.tab === "payouts" ? (
            <div className="adm-o-pane" data-tk="payouts-pane">
              {payouts.canFinance ? (
                <>
                  <p className="adm-k-help">Withdrawals by advertisers. Approve sends the payout through the payout provider. Credits go back if a payout is rejected or fails.</p>
                  <PayoutsQueue rows={payouts.rows} />
                  <h2 className="adm-o-h">TDS, GST and payout rules</h2>
                  {payouts.settings ? <TaxSettingsForm initial={payouts.settings} /> : null}
                </>
              ) : (
                <Notice kind="warn" title="Finance role needed">
                  Ask an admin to add the finance role to see payouts.
                </Notice>
              )}
            </div>
          ) : (
            <>
              <FilterBar search={search} onSearch={setSearch} searchLabel="Search orders" placeholder="Order ID, user name or email" chips={chips} onRemoveChip={onRemove} addable={addable} onAdd={onAdd} />
              <ServerTable
                label={TAB_LABELS[query.tab]}
                columns={columns}
                rows={list.rows}
                rowId={(row) => row.id}
                rowLabel={(row) => row.ref}
                total={list.total}
                page={query.page}
                pageSize={query.pageSize}
                onPage={(page) => go({ page: page === 1 ? null : String(page), open: null })}
                onPageSize={(size) => go({ size: size === 25 ? null : String(size), page: null, open: null })}
                openId={open?.id ?? null}
                onOpen={(row) => go({ open: row.id })}
                empty={
                  <div className="adm-o-state" data-tk="orders-empty">
                    <span className="adm-o-state-icon" aria-hidden="true"><SearchX /></span>
                    <h3>{searching ? `Nothing matches "${query.q}"` : "Nothing here yet"}</h3>
                    <p>{searching ? "Try the full order number such as TK-1A2B3C4D, an exact email, or the first letters of a name." : "Rows appear here as soon as there is something in this period. Try All time."}</p>
                    {searching ? (
                      <Button onClick={() => { setSearch(""); sentSearch.current = ""; go({ q: null, page: null }); }}>Clear search</Button>
                    ) : query.range !== "all" ? (
                      <Button onClick={() => go({ range: "all", page: null })}>Show all time</Button>
                    ) : null}
                  </div>
                }
              />
              {query.tab === "refunds" ? (
                <div className="adm-o-pane" data-tk="blocked-refunds">
                  <h2 className="adm-o-h">Refunds to handle by hand</h2>
                  <p className="adm-k-help">The provider refunded these purchases after the credits were already spent. Nothing was taken back automatically.</p>
                  <BlockedRefunds rows={blocked} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
      <Drawer
        open={Boolean(open)}
        title={open ? open.ref : ""}
        subtitle={open ? `${dateLabel(open.at, now)} · ${open.who}` : ""}
        onClose={() => go({ open: null })}
        footer={
          open?.receipt ? (
            <>
              <Button href={open.receipt} target="_blank" rel="noopener" icon={ExternalLink}>
                Receipt
              </Button>
              <span className="adm-k-sp" />
              <Button onClick={() => go({ open: null })}>Close</Button>
            </>
          ) : undefined
        }
      >
        {open ? (
          <div className="adm-o-detail" data-tk="order-drawer">
            {open.test ? <Notice kind="warn" title="TEST">This was a test payment. No money was taken, and it is not counted in sales.</Notice> : null}
            <dl className="adm-o-kvs">
              {open.details.map(([label, value]) => (
                <div key={label} className="adm-o-kv">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <OrderActions key={open.id} row={open} />
          </div>
        ) : null}
      </Drawer>
    </div>
    </ToastProvider>
  );
}
