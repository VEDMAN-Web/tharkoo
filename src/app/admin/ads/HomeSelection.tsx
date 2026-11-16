"use client";

import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { saveHomeSelectionAction } from "./home-actions";
import type { HomeSelectionRow } from "@/server/listings/home-selection";

type Message = { kind: "info" | "error"; text: string };

function Row({ row, onMessage }: { row: HomeSelectionRow; onMessage: (message: Message) => void }) {
  const [show, setShow] = useState(row.show);
  const [order, setOrder] = useState(String(row.order));
  const [busy, setBusy] = useState(false);

  async function save() {
    const value = Number(order);
    if (!Number.isInteger(value) || value < 0 || value > 9999) {
      onMessage({ kind: "error", text: "Enter an order from 0 to 9999." });
      return;
    }
    setBusy(true);
    const res = await saveHomeSelectionAction({ listingId: row.id, show, order: value });
    setBusy(false);
    onMessage(res.ok ? { kind: "info", text: `Saved "${row.title}".` } : { kind: "error", text: res.message });
  }

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <td style={{ padding: "6px 8px 6px 0" }}>{row.title}</td>
      <td>{row.status}</td>
      <td>
        <label>
          <input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /> Show on Home
        </label>
      </td>
      <td>
        <label className="adm-field-label" htmlFor={`home-order-${row.id}`} style={{ position: "absolute", left: -9999 }}>
          Order for {row.title}
        </label>
        <input
          id={`home-order-${row.id}`}
          className="adm-input"
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          step={1}
          value={order}
          style={{ width: 90 }}
          onChange={(event) => setOrder(event.target.value)}
        />
      </td>
      <td>
        <button type="button" className="adm-btn" disabled={busy} onClick={save}>
          {busy ? "Saving" : "Save"}
        </button>
      </td>
    </tr>
  );
}

export function HomeSelection({ rows }: { rows: HomeSelectionRow[] }) {
  const [message, setMessage] = useState<Message | null>(null);
  return (
    <section className="adm-card" aria-labelledby="home-selection-heading" style={{ marginBottom: 16 }} data-tk="home-selection">
      <h2 id="home-selection-heading" className="t-h4">Ads on the Home page</h2>
      <p className="t-small text-muted">
        Tick Show on Home to put an ad in the Latest ads row. The lowest order comes first. The row holds 8 ads: the chosen ones first, then the newest ads.
      </p>
      {rows.length === 0 ? (
        <p className="t-small text-muted">No ads yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="t-small" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th scope="col">Ad</th>
                <th scope="col">Status</th>
                <th scope="col">Home</th>
                <th scope="col">Order</th>
                <th scope="col">Save</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.id} row={row} onMessage={setMessage} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message ? (
        <div style={{ marginTop: 12 }}>
          <Notice kind={message.kind === "error" ? "error" : "info"}>{message.text}</Notice>
        </div>
      ) : null}
    </section>
  );
}
