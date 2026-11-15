"use client";

import { useState } from "react";
import { Notice } from "@/components/admin/ui";
import { AWAY_HOURS_MAX, AWAY_HOURS_MIN } from "@/server/availability/status";
import { saveAwayHoursAction } from "./availability-actions";

type Banner = { kind: "error" | "info"; text: string };

/** H7.5: admins. Hours without activity before a seller's "Online now" turns to "Away". */
export function AwayHoursSetting({ initial }: { initial: number }) {
  const [hours, setHours] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    const result = await saveAwayHoursAction(Number(hours));
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.error });
    setHours(String(result.awayAfterHours));
    setNotice({ kind: "info", text: `Saved. Sellers show Away after ${result.awayAfterHours} hour${result.awayAfterHours === 1 ? "" : "s"} with no activity.` });
  }

  return (
    <section className="mb-3" aria-labelledby="away-hours-title">
      <h2 className="t-h3" id="away-hours-title">Available now: Away after</h2>
      <p className="t-small text-muted">
        A seller who turns on &quot;Available now&quot; shows Online now until this many hours pass with no activity, then Away. Chat still works when Away. Calls pause.
      </p>
      <label className="flex flex-col t-small">
        Hours ({AWAY_HOURS_MIN} to {AWAY_HOURS_MAX})
        <input
          className="adm-input"
          type="number"
          min={AWAY_HOURS_MIN}
          max={AWAY_HOURS_MAX}
          step={1}
          inputMode="numeric"
          value={hours}
          disabled={busy}
          onChange={(event) => setHours(event.target.value)}
        />
      </label>
      <button type="button" className="adm-btn mt-2" onClick={save} disabled={busy}>
        {busy ? "Saving..." : "Save hours"}
      </button>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </section>
  );
}
