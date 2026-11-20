"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/admin/ui";
import { saveGoogleAnalyticsIdAction } from "./analytics-actions";
import { SettingItem } from "./_view/SettingItem";

type Banner = { kind: "error" | "info"; text: string };

/** H17.11: admins. The Google Analytics measurement ID. Empty means no tag. Visitors choose Accept on the cookie notice before anything loads. */
export function GoogleAnalyticsSetting({ initial }: { initial: string }) {
  const [id, setId] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    const result = await saveGoogleAnalyticsIdAction(id);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.message });
    setId(result.id);
    setNotice({ kind: "info", text: result.id ? `Saved. The tag loads for visitors who choose Accept on the cookie notice.` : "Saved. No Google Analytics tag is on the site." });
  }

  return (
    <SettingItem
      id="google-analytics-title"
      title="Google Analytics ID"
      help="The measurement ID from Google Analytics, for example G-ABC123XYZ4. Leave it empty for no tag. The tag loads only on public pages and only after a visitor chooses Accept on the cookie notice. It never loads in the admin."
    >
      <div className="adm-k-field">
        <label className="adm-k-label" htmlFor="google-analytics-id">Measurement ID</label>
        <input
          id="google-analytics-id"
          className="adm-k-input"
          type="text"
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          placeholder="G-ABC123XYZ4"
          value={id}
          disabled={busy}
          onChange={(event) => setId(event.target.value)}
        />
      </div>
      <div className="adm-s-actions">
        <Button kind="primary" busy={busy} onClick={() => void save()}>Save Google Analytics ID</Button>
      </div>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </SettingItem>
  );
}
