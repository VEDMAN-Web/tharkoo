"use client";

import { useState } from "react";
import { Button, Notice, Toggle } from "@/components/admin/ui";
import { WATERMARK_OPACITY_MAX, WATERMARK_OPACITY_MIN, WATERMARK_POSITIONS, type WatermarkPosition, type WatermarkSettings } from "@/server/settings/watermark-rules";
import { saveWatermarkAction } from "./watermark-actions";
import { SettingItem } from "./_view/SettingItem";

const POSITION_LABEL: Record<WatermarkPosition, string> = {
  north_west: "Top left",
  north_east: "Top right",
  south_west: "Bottom left",
  south_east: "Bottom right",
  center: "Centre",
};

type Banner = { kind: "error" | "info"; text: string };

/** H6.18: superadmin only. The mark "tharkoo.com" on ad photos and videos. New uploads get it; the daily job adds it to older ads. */
export function WatermarkSettings({ initial }: { initial: WatermarkSettings }) {
  const [draft, setDraft] = useState<WatermarkSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function save() {
    setBusy(true);
    setNotice(null);
    const result = await saveWatermarkAction(draft);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.error });
    setDraft(result.data);
    setNotice({ kind: "info", text: "Saved. New ad photos and videos get the watermark with these settings." });
  }

  return (
    <SettingItem
      id="watermark-title"
      title="Watermark on ad photos and videos"
      help='Adds the text "tharkoo.com" to every ad photo and video, inside the file itself. It is about a fifth of the width. Site images are not marked.'
    >
      <Toggle checked={draft.enabled} onChange={(next) => setDraft({ ...draft, enabled: next })} label="Add the watermark" disabled={busy} />
      <div className="adm-s-grid">
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="watermark-position">Position</label>
          <select
            id="watermark-position"
            className="adm-k-select"
            value={draft.position}
            disabled={busy || !draft.enabled}
            onChange={(event) => setDraft({ ...draft, position: event.target.value as WatermarkPosition })}
          >
            {WATERMARK_POSITIONS.map((value) => (
              <option key={value} value={value}>{POSITION_LABEL[value]}</option>
            ))}
          </select>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="watermark-opacity">Opacity: {draft.opacity}%</label>
          <input
            id="watermark-opacity"
            type="range"
            min={WATERMARK_OPACITY_MIN}
            max={WATERMARK_OPACITY_MAX}
            step={5}
            value={draft.opacity}
            disabled={busy || !draft.enabled}
            onChange={(event) => setDraft({ ...draft, opacity: Number(event.target.value) })}
          />
        </div>
      </div>
      <div className="adm-s-actions">
        <Button kind="primary" busy={busy} onClick={() => void save()}>Save watermark</Button>
      </div>
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </SettingItem>
  );
}
