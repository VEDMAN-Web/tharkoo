"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/admin/ui";
import type { UserDetail } from "@/server/admin/users";
import { setExtraFreeAdsAction } from "./actions";
import { useAnswer } from "./useAnswer";
import "./profile.css";

/** H11.1b: "Extra free ads" for one person, on top of the site setting "Free ads for each account". Admin only; the change is audited and can be undone. */
export function FreeAdsCard({ detail }: { detail: UserDetail }) {
  const answer = useAnswer();
  const [value, setValue] = useState(String(detail.user.extraFreeAds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const extra = Number(value.trim());
  const valid = value.trim() !== "" && Number.isInteger(extra) && extra >= 0 && extra <= 1000;
  const dirty = value.trim() !== String(detail.user.extraFreeAds);

  async function save() {
    if (!valid) return setError("Enter a whole number from 0 to 1000.");
    setError("");
    setBusy(true);
    const result = await setExtraFreeAdsAction({ userId: detail.user.id, extra });
    setBusy(false);
    answer(result, "Extra free ads");
  }

  return (
    <section className="adm-up-box" aria-labelledby="uf-h" data-tk="free-ads-card">
      <div className="adm-up-head">
        <h3 id="uf-h"><Gift aria-hidden="true" size={16} /> Extra free ads</h3>
      </div>
      <p className="adm-k-help">Free ads for this person, on top of the free ads every account gets. Their ads are counted from the first one they published.</p>
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="user-extra-free">Extra free ads</label>
        <input id="user-extra-free" className="adm-k-input" inputMode="numeric" autoComplete="off" value={value} aria-invalid={error ? true : undefined} onChange={(event) => { setValue(event.target.value); setError(""); }} />
        {error ? <p className="adm-k-err" role="alert">{error}</p> : null}
      </div>
      {dirty ? <Button kind="primary" busy={busy} onClick={() => void save()}>Save extra free ads</Button> : null}
    </section>
  );
}
