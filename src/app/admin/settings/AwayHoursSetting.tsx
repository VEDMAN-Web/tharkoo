"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/admin/ui";
import { AWAY_HOURS_MAX, AWAY_HOURS_MIN } from "@/server/availability/status";
import { saveAwayHoursAction } from "./availability-actions";
import { SettingItem } from "./_view/SettingItem";

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
    <SettingItem
      id="away-hours-title"
      title="Available now: Away after"
      help='A seller who turns on "Available now" shows Online now until this many hours pass with no activity, then Away. Chat still works when Away. Calls pause.'
    >
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="away-hours">Hours ({AWAY_HOURS_MIN} to {AWAY_HOURS_MAX})</label>
        <input
          id="away-hours"
          className="adm-k-input"
          type="number"
          min={AWAY_HOURS_MIN}
          max={AWAY_HOURS_MAX}
          step={1}
          inputMode="numeric"
          value={hours}
          disabled={busy}
          onChange={(event) => setHours(event.target.value)}
        />
      </div>
      <div className="adm-s-actions">
        <Button kind="primary" busy={busy} onClick={() => void save()}>Save hours</Button>
      </div>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </SettingItem>
  );
}
