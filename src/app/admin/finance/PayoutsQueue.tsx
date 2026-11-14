"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DataTable, Notice, TextField, type Column } from "@/components/admin/ui";
import { api, friendlyError } from "@/lib/ui/api";

/** Revealed details disappear after this long, and are never kept in the page after that. */
const REVEAL_MS = 60_000;

interface RevealedDetails {
  method: "bank" | "upi";
  legalName: string;
  pan: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
}

interface Revealed {
  withdrawalId: string;
  details: RevealedDetails;
  expiresAt: number;
}

function detailsText(details: RevealedDetails) {
  const lines = [`Name: ${details.legalName}`, `PAN: ${details.pan}`];
  if (details.method === "upi") lines.push(`UPI ID: ${details.upiId ?? ""}`);
  else lines.push(`Account: ${details.accountNumber ?? ""}`, `IFSC: ${details.ifsc ?? ""}`);
  return lines.join("\n");
}

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
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const actions = selected ? ACTIONS[selected.status] ?? [] : [];

  // Hide revealed details after 60 seconds, whatever the staff member is doing.
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(null), Math.max(0, revealed.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [revealed]);

  const columns: Column<PayoutRow>[] = [
    ...COLUMNS,
    {
      key: "open",
      label: "Action",
      value: () => "",
      render: (row) => (
        <button
          type="button"
          className="adm-btn adm-btn-quiet"
          aria-pressed={row.id === selectedId}
          onClick={() => {
            setSelectedId(row.id);
            setRevealed(null);
          }}
        >
          {row.id === selectedId ? "Selected" : "Open"}
        </button>
      ),
    },
  ];

  async function reveal() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const res = await api<{ withdrawalId: string; details: RevealedDetails }>(`/api/wallet/admin/payouts/${selected.id}/reveal`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setMessage({ kind: "error", text: friendlyError(res.error) });
    setRevealed({ withdrawalId: selected.id, details: res.data.details, expiresAt: Date.now() + REVEAL_MS });
  }

  async function copyRevealed(details: RevealedDetails) {
    try {
      await navigator.clipboard.writeText(detailsText(details));
      setMessage({ kind: "info", text: "Copied. The details will hide after 60 seconds." });
    } catch {
      setMessage({ kind: "error", text: "Could not copy. Select the text and copy it by hand." });
    }
  }

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
    setRevealed(null);
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
          {selected.payout ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                <button type="button" className="adm-btn adm-btn-quiet" disabled={busy} onClick={reveal}>
                  Reveal full details
                </button>
              </div>
              {revealed && revealed.withdrawalId === selected.id ? (
                <section aria-label="Revealed payout details" style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--adm-border, #ddd)", borderRadius: 8 }}>
                  <p className="t-small">Shown for 60 seconds. Do not share it.</p>
                  <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 12px", margin: 0 }}>
                    <dt>Name</dt>
                    <dd style={{ margin: 0 }}>{revealed.details.legalName}</dd>
                    <dt>PAN</dt>
                    <dd style={{ margin: 0 }}>{revealed.details.pan}</dd>
                    {revealed.details.method === "upi" ? (
                      <>
                        <dt>UPI ID</dt>
                        <dd style={{ margin: 0 }}>{revealed.details.upiId}</dd>
                      </>
                    ) : (
                      <>
                        <dt>Account</dt>
                        <dd style={{ margin: 0 }}>{revealed.details.accountNumber}</dd>
                        <dt>IFSC</dt>
                        <dd style={{ margin: 0 }}>{revealed.details.ifsc}</dd>
                      </>
                    )}
                  </dl>
                  <div>
                    <button type="button" className="adm-btn" onClick={() => copyRevealed(revealed.details)}>
                      Copy
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {message ? <Notice kind={message.kind === "error" ? "error" : "info"}>{message.text}</Notice> : null}
    </div>
  );
}
