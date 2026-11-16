"use client";

import { useState } from "react";
import { saveHomeCategoriesCountForAdmin } from "@/app/admin/content-actions";

export function HomeCategoriesCountField({ initial }: { initial: number }) {
  const [value, setValue] = useState(String(initial));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await saveHomeCategoriesCountForAdmin(Number(value));
    setBusy(false);
    if (result.ok) setValue(String(result.count));
    setMessage(result.ok ? "Saved." : result.message);
  }

  return (
    <section className="adm-card" aria-labelledby="home-cats-count">
      <h2 id="home-cats-count" className="t-h4">
        Home categories
      </h2>
      <label className="adm-field">
        Number of categories on Home (1 to 8)
        <input type="number" min={1} max={8} value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <p className="adm-field-help">The Home page shows the first categories by admin order. The rest stay reachable from All categories.</p>
      <button type="button" className="adm-btn" disabled={busy} onClick={() => void save()}>
        Save number of categories
      </button>
      {message ? <p className="adm-field-help" role="status">{message}</p> : null}
    </section>
  );
}
