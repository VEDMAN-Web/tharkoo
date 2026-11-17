"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import { Badge, Button, useToast } from "@/components/admin/ui";
import type { CreditLine, CreditsTab as CreditsData } from "@/server/billing/staff-credits";
import { dateLabel } from "../_list/format";
import { creditWords, signed, type CreditsStart } from "./credits-format";
import "./credits.css";

/** The Credits tab of the Users drawer (H8.14): balance, spend, paid total, and the latest ledger lines with Receipt and Undo. */
export function CreditsTab({ data, canAdjust, onAdjust }: { data: CreditsData; canAdjust: boolean; onAdjust: (start: CreditsStart) => void }) {
  const toast = useToast();
  const router = useRouter();
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState("");
  const now = new Date();

  async function undo(line: CreditLine) {
    if (!line.staff) return;
    setBusy(line.id);
    const outcome = await undoAction(line.staff.eventId);
    setBusy("");
    toast.show(outcome.ok ? { kind: "success", message: "Credit change undone." } : { kind: "error", message: outcome.message });
    router.refresh();
  }

  function side(line: CreditLine) {
    if (line.receipt) {
      return (
        <Button kind="quiet" size="sm" aria-expanded={receipt === line.id} onClick={() => setReceipt(receipt === line.id ? "" : line.id)}>
          Receipt
        </Button>
      );
    }
    const staff = line.staff;
    if (!staff) return null;
    if (staff.state === "undoable") {
      return (
        <Button size="sm" icon={Undo2} busy={busy === line.id} aria-label={`Undo ${signed(line.delta)} credits`} onClick={() => void undo(line)}>
          Undo
        </Button>
      );
    }
    if (staff.state === "partly_spent") {
      return (
        <>
          <small>Only {creditWords(staff.left)} left</small>
          {canAdjust ? (
            <Button size="sm" onClick={() => onAdjust({ mode: "remove", amount: String(staff.left) })}>
              {`Take back ${staff.left.toLocaleString("en-IN")}...`}
            </Button>
          ) : null}
        </>
      );
    }
    if (staff.state === "spent") return <Badge tone="neutral">Spent</Badge>;
    if (staff.state === "undone") return <Badge tone="neutral">Undone</Badge>;
    if (staff.state === "expired") return <Badge tone="neutral">Undo time passed</Badge>;
    return <small>Made by someone else</small>;
  }

  return (
    <>
      <div className="adm-u-stats adm-c-stats" data-tk="credits-stats">
        <div className="adm-u-stat">
          <span>Balance</span>
          <strong data-tk="credits-tab-balance">{data.balance.toLocaleString("en-IN")}</strong>
        </div>
        <div className="adm-u-stat">
          <span>Spent, 30 days</span>
          <strong>{data.spent30.toLocaleString("en-IN")}</strong>
        </div>
        <div className="adm-u-stat">
          <span>Paid, all time</span>
          <strong>{`₹${data.paidTotal.toLocaleString("en-IN")}`}</strong>
        </div>
      </div>
      {data.lines.length === 0 ? (
        <p className="adm-k-help" data-tk="credits-empty">No credit changes yet. Credits show here after a recharge, a purchase or a staff change.</p>
      ) : (
        <ul className="adm-c-lines" data-tk="credits-lines">
          {data.lines.map((line) => (
            <li key={line.id} className="adm-c-line" data-tk="credits-line">
              <span className="adm-c-delta" data-sign={line.delta > 0 ? "plus" : "minus"}>{signed(line.delta)}</span>
              <span className="adm-c-what">
                <strong>{line.title}</strong>
                <small>{[line.detail, dateLabel(line.at, now)].filter(Boolean).join(" · ")}{line.staff?.state === "undoable" ? " · unspent" : ""}</small>
              </span>
              <span className="adm-c-side">{side(line)}</span>
              {line.receipt && receipt === line.id ? (
                <dl className="adm-c-receipt" data-tk="credits-receipt">
                  <dt>Receipt</dt>
                  <dd>{line.receipt.no}</dd>
                  <dt>Amount</dt>
                  <dd>{`₹${line.receipt.amount.toLocaleString("en-IN")}`}</dd>
                  <dt>Paid by</dt>
                  <dd>{line.receipt.method}</dd>
                  {line.receipt.test ? (
                    <>
                      <dt>Type</dt>
                      <dd><Badge tone="warn">TEST</Badge></dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {data.total > data.lines.length ? <p className="adm-k-help">{`Showing the latest ${data.lines.length} of ${data.total.toLocaleString("en-IN")} lines.`}</p> : null}
      <p className="adm-k-help">Staff changes need a reason and can be undone for 7 days while unspent.</p>
    </>
  );
}
