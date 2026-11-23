"use client";

import { useState } from "react";
import { Button, Toggle } from "@/components/admin/ui";
import { COIN_MAX, COIN_MIN, isCoinPrice, shareLine } from "@/app/admin/settings/video-tours/shared";
import { saveCategoryVideoAction } from "../video-actions";

export type VideoDraft = { enabled: boolean; coins: string };

/**
 * H19.8: the "Video calls" part of the category form: the switch, the price per call and the one help line.
 * `lock` is the reason the switch cannot be on (people listing, kind without video, no kind yet); empty when it is free.
 */
export function VideoCallsFields({ draft, lock, canEdit, sharePercent, onChange, idPrefix }: { draft: VideoDraft; lock: string; canEdit: boolean; sharePercent: number; onChange: (next: VideoDraft) => void; idPrefix: string }) {
  const locked = lock !== "";
  const valid = isCoinPrice(draft.coins);
  const off = !canEdit || locked;
  return (
    <div className="adm-cat-wide" data-tk="video-calls">
      <h3 className="adm-cat-group">Video calls</h3>
      <Toggle label={locked ? "Video calls: Off" : draft.enabled ? "Video calls: On" : "Video calls: Off"} checked={!locked && draft.enabled} disabled={off} onChange={(enabled) => onChange({ ...draft, enabled })} />
      {locked ? <p className="adm-k-help" data-tk="video-lock">{lock}</p> : null}
      {!canEdit && !locked ? <p className="adm-k-help" data-tk="video-superadmin">Only a superadmin changes video calls.</p> : null}
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor={`${idPrefix}-price`}>Price per call (credits)</label>
        <input
          id={`${idPrefix}-price`}
          className="adm-k-input"
          type="number"
          inputMode="numeric"
          min={COIN_MIN}
          max={COIN_MAX}
          step={1}
          disabled={off}
          value={draft.coins}
          aria-invalid={valid ? undefined : true}
          aria-describedby={`${idPrefix}-price-help`}
          onChange={(event) => onChange({ ...draft, coins: event.target.value })}
        />
        {valid ? null : <p className="adm-k-err" role="alert">{`Enter a whole number from ${COIN_MIN} to ${COIN_MAX}.`}</p>}
        <p className="adm-k-help" id={`${idPrefix}-price-help`} data-tk="video-share-line">{shareLine(sharePercent)}</p>
      </div>
    </div>
  );
}

/** The saved category: its own Save for the video switch and price (same server rules as the Video tours page). */
export function CategoryVideoSection({ categoryId, initial, lock, canEdit, sharePercent }: { categoryId: string; initial: { enabled: boolean; coins: number }; lock: string; canEdit: boolean; sharePercent: number }) {
  const [saved, setSaved] = useState<VideoDraft>({ enabled: initial.enabled, coins: String(initial.coins) });
  const [draft, setDraft] = useState<VideoDraft>(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = draft.enabled !== saved.enabled || draft.coins !== saved.coins;

  async function save() {
    if (!isCoinPrice(draft.coins)) return setMessage({ ok: false, text: `Enter a whole number from ${COIN_MIN} to ${COIN_MAX}.` });
    setBusy(true);
    setMessage(null);
    const result = await saveCategoryVideoAction(categoryId, { enabled: draft.enabled, coins: Number(draft.coins) });
    setBusy(false);
    if (!result.ok) return setMessage({ ok: false, text: result.message });
    const next = { enabled: result.data.enabled, coins: String(result.data.coins) };
    setSaved(next);
    setDraft(next);
    setMessage({ ok: true, text: "Video calls saved." });
  }

  return (
    <>
      <VideoCallsFields draft={draft} lock={lock} canEdit={canEdit} sharePercent={sharePercent} idPrefix="cat-video" onChange={(next) => { setDraft(next); setMessage(null); }} />
      {canEdit && !lock && dirty ? (
        <div className="adm-cat-wide" role="group" aria-label="Save video calls">
          <Button kind="primary" busy={busy} onClick={() => void save()}>Save video calls</Button>
        </div>
      ) : null}
      {message ? <p className={message.ok ? "adm-k-help" : "adm-k-err"} role={message.ok ? "status" : "alert"} data-tk="video-message">{message.text}</p> : null}
    </>
  );
}
