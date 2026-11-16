"use client";

import { useState } from "react";
import { saveListingBandForAdmin } from "@/app/admin/content-actions";

export function ListingBandSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [message, setMessage] = useState("");

  async function change(next: boolean) {
    const result = await saveListingBandForAdmin(next);
    if (result.ok) setOn(result.on);
    setMessage(result.ok ? "Saved." : result.message);
  }

  return (
    <section className="adm-card" aria-labelledby="listing-band-heading">
      <h2 id="listing-band-heading" className="t-h4">
        Listing pages
      </h2>
      <label className="adm-field adm-check">
        <input type="checkbox" checked={on} onChange={(event) => void change(event.target.checked)} />
        Show photo band on listing pages
      </label>
      <p className="adm-field-help">Off: every category, city, state, district and tag page uses the same compact header as search. On: the big photo band comes back.</p>
      {message ? <p className="adm-field-help" role="status">{message}</p> : null}
    </section>
  );
}
