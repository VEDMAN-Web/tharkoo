"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Notice, Toggle } from "@/components/admin/ui";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import type { UserDetail } from "@/server/admin/users";
import { editVendorAction } from "./actions";
import { useAnswer } from "./useAnswer";
import "./profile.css";

const ABOUT_MAX = 500;
const coins = (value: number) => `${value.toLocaleString("en-IN")} ${value === 1 ? "coin" : "coins"}`;

/** Vendor profile of a seller: about text, WhatsApp, profile picture, hide switch, read only earnings and live tour words. Hiding is a flag; nothing is deleted. */
export function VendorTab({ detail, canEdit }: { detail: UserDetail; canEdit: boolean }) {
  const vendor = detail.vendor;
  const answer = useAnswer();
  const [about, setAbout] = useState(vendor?.about ?? "");
  const [whatsapp, setWhatsapp] = useState(vendor?.whatsapp ?? "");
  const [photo, setPhoto] = useState<ImageRef | null>(vendor?.photo ? { assetId: vendor.photo.id, src: vendor.photo.src, alt: vendor.photo.alt, width: 0, height: 0 } : null);
  const [hidden, setHidden] = useState(vendor?.hidden ?? false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!vendor) return null;
  const closed = detail.user.status === "deleted";
  const editable = canEdit && !closed;
  const hiding = hidden && !vendor.hidden;
  const dirty = about.trim() !== vendor.about || whatsapp.trim() !== (vendor.whatsapp ?? "") || (photo?.assetId ?? "") !== (vendor.photo?.id ?? "") || hidden !== vendor.hidden;

  async function save() {
    if (hiding && !reason.trim()) {
      setError("Say why this vendor profile is hidden.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await editVendorAction({ userId: detail.user.id, about, whatsapp, photoMediaId: photo?.assetId ?? "", hidden, reason });
    setBusy(false);
    if (!result.ok) setError(result.message);
    else if (answer(result, "The vendor change")) setReason("");
  }

  return (
    <form
      className="adm-up"
      data-tk="vendor-tab"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="adm-up-head">
        <strong>{detail.user.name}</strong>
        {vendor.hidden ? <Badge tone="bad">Vendor profile hidden</Badge> : null}
      </div>
      <Notice kind="info"><span data-tk="not-shown">This vendor profile is not shown on the site yet. What you save here is kept for when it is.</span></Notice>
      {error ? <p className="adm-k-err" role="alert" data-tk="vendor-error">{error}</p> : null}
      <div className="adm-k-field">
        <label className="adm-k-label adm-k-lab" htmlFor="uv-about">
          <span>About</span>
          <span className="adm-k-count">{about.length} / {ABOUT_MAX}</span>
        </label>
        <textarea id="uv-about" className="adm-k-input" rows={4} value={about} maxLength={ABOUT_MAX + 50} disabled={!editable} onChange={(event) => setAbout(event.target.value)} />
      </div>
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="uv-wa">WhatsApp number</label>
        <input id="uv-wa" className="adm-k-input" inputMode="tel" value={whatsapp} disabled={!editable} onChange={(event) => setWhatsapp(event.target.value)} />
      </div>
      <div className="adm-k-field">
        {editable ? <ImagePicker label="Profile picture" value={photo} onChange={setPhoto} /> : <span className="adm-k-help">{photo ? "A profile picture is set." : "No profile picture."}</span>}
      </div>
      <div className="adm-k-field">
        <Toggle checked={hidden} onChange={setHidden} label="Hide this vendor profile" disabled={!editable} />
        <p className="adm-k-help">Hiding keeps everything and only switches the profile off. Show it again at any time.</p>
      </div>
      {hiding ? (
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="uv-reason">Reason <span className="adm-k-req" aria-hidden="true">*</span></label>
          <input id="uv-reason" className="adm-k-input" value={reason} maxLength={200} aria-required="true" onChange={(event) => setReason(event.target.value)} />
        </div>
      ) : null}
      {editable ? (
        <div className="adm-up-actions">
          <Button type="submit" kind="primary" busy={busy} disabled={!dirty || busy}>Save vendor profile</Button>
        </div>
      ) : null}

      <section className="adm-up-box" aria-labelledby="uv-earn-h" data-tk="vendor-earnings">
        <h3 id="uv-earn-h">Earnings</h3>
        {vendor.earnings ? (
          <>
            <dl className="adm-up-stats">
              <div><dt>Waiting to be paid out</dt><dd data-tk="earn-balance">{coins(vendor.earnings.balance)}</dd></div>
              <div><dt>Payout asked for</dt><dd>{coins(vendor.earnings.requested)}</dd></div>
              <div><dt>Paid out</dt><dd>{coins(vendor.earnings.paid)}</dd></div>
            </dl>
            <Link className="adm-k-btn adm-k-btn-sm" href="/admin/finance/?tab=payouts">Open Payouts</Link>
          </>
        ) : (
          <p className="adm-k-help">Earnings are shown to finance and admins.</p>
        )}
      </section>
      <Notice kind="info">Live video tours are switched on or off for each category, and the price is set there too. Open Categories and fields to change them. A vendor cannot have a tour switch of their own.</Notice>
    </form>
  );
}
