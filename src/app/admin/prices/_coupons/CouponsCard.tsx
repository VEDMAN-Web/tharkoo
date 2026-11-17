"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge, Button, Drawer, Toggle } from "@/components/admin/ui";
import type { CouponRow } from "@/server/billing/coupons-admin";
import { useAnswer } from "../_view/useAnswer";
import { createCouponAction, saveCouponAction } from "./actions";
import { fromIstDate, istDate, limitsText, offerText, runsText } from "./coupon-format";

type Form = { code: string; kind: "percent" | "credits"; amount: string; startsAt: string; endsAt: string; maxRedemptions: string; perUserLimit: string; on: boolean };

const NEW_COUPON: Form = { code: "", kind: "percent", amount: "", startsAt: "", endsAt: "", maxRedemptions: "", perUserLimit: "1", on: true };

/** The coupons table and the drawer that edits or adds one coupon. Anchor: #coupons. */
export function CouponsCard({ coupons, canEdit }: { coupons: CouponRow[]; canEdit: boolean }) {
  const answer = useAnswer();
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);

  return (
    <section className="adm-card adm-p-card adm-p-plans" id="coupons" data-tk="coupons" aria-labelledby="coupons-title">
      <header className="adm-p-head">
        <h2 id="coupons-title">Coupons</h2>
        <span className="adm-k-help">{`${coupons.length} ${coupons.length === 1 ? "coupon" : "coupons"}`}</span>
        {canEdit ? (
          <Button icon={Plus} onClick={() => setEditing("new")}>
            New coupon
          </Button>
        ) : null}
      </header>
      <div className="adm-k-tablewrap adm-p-wrap">
        <table className="adm-k-table" data-tk="coupons-table">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Offer</th>
              <th scope="col" className="adm-k-hide-phone">Runs</th>
              <th scope="col">Used</th>
              <th scope="col">Status</th>
              <th scope="col">{canEdit ? "Edit" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((coupon) => (
              <tr key={coupon.id} data-tk="coupon-row" data-code={coupon.code}>
                <td className="adm-k-main"><strong>{coupon.code || "No code"}</strong></td>
                <td>{offerText(coupon.kind, coupon.amount)}</td>
                <td className="adm-k-hide-phone">{runsText(coupon.startsAt, coupon.endsAt)}</td>
                <td>{limitsText(coupon.redeemed, coupon.maxRedemptions, coupon.perUserLimit)}</td>
                <td>{coupon.kind === "label" ? <Badge>Text only</Badge> : coupon.on ? <Badge tone="ok">On</Badge> : <Badge>Off</Badge>}</td>
                <td className="adm-k-rowact">
                  {canEdit ? (
                    <Button size="sm" icon={Pencil} disabled={coupon.kind === "label"} onClick={() => setEditing(coupon)}>
                      Edit
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={6}>No coupons yet. Use New coupon to add one.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {editing ? <CouponDrawer key={editing === "new" ? "new" : editing.id} coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={answer} /> : null}
    </section>
  );
}

function CouponDrawer({ coupon, onClose, onSaved }: { coupon: CouponRow | null; onClose: () => void; onSaved: (result: Awaited<ReturnType<typeof saveCouponAction>>, message: string) => boolean }) {
  const [form, setForm] = useState<Form>(
    coupon
      ? { code: coupon.code, kind: coupon.kind === "credits" ? "credits" : "percent", amount: String(coupon.amount), startsAt: istDate(coupon.startsAt), endsAt: istDate(coupon.endsAt), maxRedemptions: coupon.maxRedemptions === null ? "" : String(coupon.maxRedemptions), perUserLimit: coupon.perUserLimit === null ? "" : String(coupon.perUserLimit), on: coupon.on }
      : NEW_COUPON,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError("");
  };

  async function save() {
    if (form.endsAt && form.startsAt && form.endsAt < form.startsAt) return setError("The end must be after the start.");
    setBusy(true);
    const body = {
      kind: form.kind,
      amount: Number(form.amount.trim()),
      startsAt: fromIstDate(form.startsAt, "start"),
      endsAt: fromIstDate(form.endsAt, "end"),
      maxRedemptions: form.maxRedemptions,
      perUserLimit: form.perUserLimit,
      on: form.on,
    };
    const result = coupon ? await saveCouponAction({ id: coupon.id, ...body }) : await createCouponAction({ code: form.code, ...body });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onSaved(result, coupon ? `Coupon ${coupon.code} saved.` : `Coupon ${form.code.trim().toUpperCase()} added.`);
    onClose();
  }

  return (
    <Drawer
      open
      title={coupon ? `Edit ${coupon.code}` : "New coupon"}
      subtitle={coupon ? "The code cannot change: people may already hold it" : "Codes are saved in capitals"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void save()}>
            {coupon ? "Save coupon" : "Add coupon"}
          </Button>
        </>
      }
    >
      <div className="adm-p-form" data-tk="coupon-form">
        {!coupon ? (
          <div className="adm-k-field">
            <label className="adm-k-label" htmlFor="coupon-code">Code<span className="adm-k-req" aria-hidden="true"> *</span></label>
            <input id="coupon-code" className="adm-k-input" autoComplete="off" value={form.code} maxLength={20} onChange={(event) => change({ code: event.target.value })} />
            <p className="adm-k-help">3 to 20 letters, digits or dashes, for example WELCOME10.</p>
          </div>
        ) : null}
        <fieldset className="adm-k-opts">
          <legend className="adm-k-label">What it gives</legend>
          <label className="adm-k-opt">
            <input type="radio" name="coupon-kind" checked={form.kind === "percent"} onChange={() => change({ kind: "percent" })} />
            Percent off
          </label>
          <label className="adm-k-opt">
            <input type="radio" name="coupon-kind" checked={form.kind === "credits"} onChange={() => change({ kind: "credits" })} />
            Free credits
          </label>
        </fieldset>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="coupon-amount">{form.kind === "percent" ? "Percent off" : "Free credits"}<span className="adm-k-req" aria-hidden="true"> *</span></label>
          <input id="coupon-amount" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.amount} onChange={(event) => change({ amount: event.target.value })} />
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="coupon-start">Starts on</label>
          <input id="coupon-start" className="adm-k-input" type="date" value={form.startsAt} onChange={(event) => change({ startsAt: event.target.value })} />
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="coupon-end">Ends on</label>
          <input id="coupon-end" className="adm-k-input" type="date" value={form.endsAt} onChange={(event) => change({ endsAt: event.target.value })} />
          <p className="adm-k-help">Leave a date empty for no start or no end. Indian time.</p>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="coupon-max">Most times it can be used</label>
          <input id="coupon-max" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.maxRedemptions} onChange={(event) => change({ maxRedemptions: event.target.value })} />
          <p className="adm-k-help">Empty means no limit.</p>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="coupon-user">Most times for each person</label>
          <input id="coupon-user" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.perUserLimit} onChange={(event) => change({ perUserLimit: event.target.value })} />
        </div>
        <Toggle checked={form.on} label={form.on ? "Coupon is on" : "Coupon is off"} onChange={(next) => change({ on: next })} />
        {error ? <p className="adm-k-err" role="alert" data-tk="coupon-error">{error}</p> : null}
      </div>
    </Drawer>
  );
}
