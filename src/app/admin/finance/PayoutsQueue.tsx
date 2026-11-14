"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, Notice, TextField, type Column } from "@/components/admin/ui";
import { api, friendlyError } from "@/lib/ui/api";

export interface PayoutRow {
  id: string;
  userId: string;
  status: string;
  method: "bank" | "upi";
  coins: number;
  amountInr: number;
  tdsPercent: number;
  gstPercent: number;
  reference: string | null;
  reason: string | null;
  requestedAt: string;
  payout: {
    method: "bank" | "upi";
    legalName: string;
    pan: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  } | null;
}

const COLUMNS: Column<PayoutRow>[] = [
  { key: "requestedAt", label: "Requested", sortable: true },
  { key: "userId", label: "Vendor" },
  { key: "status", label: "Status", sortable: true },
  { key: "coins", label: "Coins", sortable: true },
  { key: "amountInr", label: "Amount (INR)", sortable: true },
  { key: "tdsPercent", label: "TDS %" },
  { key: "gstPercent", label: "GST %" },
  { key: "name", label: "Name", value: (row) => row.payout?.legalName ?? "" },
  { key: "pan", label: "PAN (masked)", value: (row) => row.payout?.pan ?? "" },
  { key: "account", label: "Account or UPI (masked)", value: (row) => row.payout?.accountNumber ?? row.payout?.upiId ?? "" },
  { key: "reference", label: "Reference", value: (row) => row.reference ?? "" },
];

const ACTIONS: Record<string, { label: string; path: "approve" | "reject" | "paid" | "failed"; needs?: "reason" | "reference" }[]> = {
  requested: [
    { label: "Approve", path: "approve" },
    { label: "Reject", path: "reject", needs: "reason" },
  ],
  approved: [
    { label: "Mark paid", path: "paid", needs: "reference" },
    { label: "Mark failed", path: "failed", needs: "reason" },
  ],
};

export function PayoutsQueue({ rows }: { rows: PayoutRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const actions = selected ? ACTIONS[selected.status] ?? [] : [];

  const columns: Column<PayoutRow>[] = [
    ...COLUMNS,
    {
      key: "open",
      label: "Action",
      value: () => "",
      render: (row) => (
        <button type="button" className="adm-btn adm-btn-quiet" aria-pressed={row.id === selectedId} onClick={() => setSelectedId(row.id)}>
          {row.id === selectedId ? "Selected" : "Open"}
        </button>
      ),
    },
  ];

  async function run(path: "approve" | "reject" | "paid" | "failed", needs?: "reason" | "reference") {
    if (!selected) return;
    const body: Record<string, string> = {};
    if (needs === "reason") {
      if (reason.trim().length < 3) return setMessage({ kind: "error", text: "Write a reason of at least 3 characters." });
      body.reason = reason.trim();
    }
    if (needs === "reference") {
      if (reference.trim().length < 4) return setMessage({ kind: "error", text: "Enter the bank or UPI reference." });
      body.reference = reference.trim();
    }
    setBusy(true);
    setMessage(null);
    const res = await api<{ status: string }>(`/api/wallet/admin/payouts/${selected.id}/${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) return setMessage({ kind: "error", text: friendlyError(res.error) });
    setMessage({ kind: "info", text: `Done: now ${res.data.status}.` });
    setReason("");
    setReference("");
    setSelectedId(null);
    router.refresh();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} csvName="payouts" emptyText="No payouts yet" />
      {selected ? (
        <section className="adm-card" aria-label="Selected payout" style={{ display: "grid", gap: 12, padding: 16 }}>
          <p className="t-small">
            <strong>{selected.coins} coins</strong> for {selected.payout?.legalName ?? "vendor"} · status {selected.status}
          </p>
          {actions.some((action) => action.needs === "reason") ? (
            <TextField label="Reason (shown to the vendor)" value={reason} onChange={setReason} min={3} max={300} />
          ) : null}
          {actions.some((action) => action.needs === "reference") ? (
            <TextField label="Bank or UPI reference" value={reference} onChange={setReference} min={4} max={64} />
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actions.map((action) => (
              <button key={action.path} type="button" className="adm-btn" disabled={busy} onClick={() => run(action.path, action.needs)}>
                {action.label}
              </button>
            ))}
            {actions.length === 0 ? <span className="t-small">No action for this status.</span> : null}
          </div>
        </section>
      ) : null}
      {message ? <Notice kind={message.kind === "error" ? "error" : "info"}>{message.text}</Notice> : null}
    </div>
  );
}
