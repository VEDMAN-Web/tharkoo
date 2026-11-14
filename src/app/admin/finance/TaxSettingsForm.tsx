"use client";

import { useState } from "react";
import { Notice, TextField } from "@/components/admin/ui";
import { api, friendlyError } from "@/lib/ui/api";

export interface FinanceValues {
  tdsPercent: number;
  gstPercent: number;
  coinValueInr: number;
  minWithdrawCoins: number;
  withdrawCooldownDays: number;
}

type Text = { [K in keyof FinanceValues]: string };

const toText = (values: FinanceValues): Text => ({
  tdsPercent: String(values.tdsPercent),
  gstPercent: String(values.gstPercent),
  coinValueInr: String(values.coinValueInr),
  minWithdrawCoins: String(values.minWithdrawCoins),
  withdrawCooldownDays: String(values.withdrawCooldownDays),
});

/**
 * Admin values for TDS, GST and payout rules. They are only stored and printed on purchase and payout records.
 * The app does not compute or deduct tax from them.
 */
export function TaxSettingsForm({ initial }: { initial: FinanceValues }) {
  const [text, setText] = useState<Text>(() => toText(initial));
  const [saved, setSaved] = useState<Text>(() => toText(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const dirty = JSON.stringify(text) !== JSON.stringify(saved);

  function field(key: keyof FinanceValues, label: string, help: string) {
    return (
      <TextField
        label={label}
        value={text[key]}
        onChange={(next) => setText((current) => ({ ...current, [key]: next.replace(/[^\d.]/g, "") }))}
        help={help}
      />
    );
  }

  async function save() {
    const values: FinanceValues = {
      tdsPercent: Number(text.tdsPercent),
      gstPercent: Number(text.gstPercent),
      coinValueInr: Number(text.coinValueInr),
      minWithdrawCoins: Number(text.minWithdrawCoins),
      withdrawCooldownDays: Number(text.withdrawCooldownDays),
    };
    if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
      return setMessage({ kind: "error", text: "Every field needs a number." });
    }
    setBusy(true);
    setMessage(null);
    const res = await api<FinanceValues>("/api/wallet/admin/settings", { method: "PUT", body: JSON.stringify(values) });
    setBusy(false);
    if (!res.ok) return setMessage({ kind: "error", text: friendlyError(res.error) });
    setSaved(toText(res.data));
    setText(toText(res.data));
    setMessage({ kind: "info", text: "Saved. New purchases and payouts use these values." });
  }

  return (
    <form
      aria-label="Tax and payout settings"
      style={{ display: "grid", gap: 14, maxWidth: 640 }}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="t-small">
        TDS and GST are recorded on each purchase and payout. The app does not calculate or deduct tax.
      </p>
      {field("tdsPercent", "TDS %", "Recorded on each record.")}
      {field("gstPercent", "GST %", "Recorded on each record.")}
      {field("coinValueInr", "Value of one coin (INR)", "Used to show prices and payout amounts.")}
      {field("minWithdrawCoins", "Minimum withdrawal (coins)", "Vendors cannot withdraw less.")}
      {field("withdrawCooldownDays", "Days between withdrawals", "One withdrawal per vendor per this many days.")}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="adm-btn" disabled={!dirty || busy}>
          {busy ? "Saving" : "Save settings"}
        </button>
        <span className="t-small">{dirty ? "Unsaved changes" : "All changes saved"}</span>
      </div>
      {message ? <Notice kind={message.kind === "error" ? "error" : "info"}>{message.text}</Notice> : null}
    </form>
  );
}
