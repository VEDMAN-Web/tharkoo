"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe } from "lucide-react";
import { Badge, Button, ReasonDialog, Toggle } from "@/components/admin/ui";
import { EMERGENCY_KEYS, EMERGENCY_LABELS, type EmergencyKey, type EmergencyState } from "@/server/settings/emergency-labels";
import { UNDO_WINDOW_KEYS, UNDO_WINDOW_LABELS, type UndoWindows } from "@/server/settings/undo-window-labels";
import { saveUndoWindowsAction, setEmergencyAction, setPostModerationAction } from "../_actions/actions";
import { useAnswer } from "./useAnswer";

/** Emergency switches: each acts at once. Turning one on asks to confirm first; turning it off needs no confirm. */
export function EmergencyCard({ state, canEdit }: { state: EmergencyState; canEdit: boolean }) {
  const answer = useAnswer();
  const [asking, setAsking] = useState<EmergencyKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(key: EmergencyKey, on: boolean) {
    setBusy(true);
    const result = await setEmergencyAction({ key, on });
    setBusy(false);
    answer(result, `${EMERGENCY_LABELS[key].title}: ${on ? "on" : "off"}.`);
  }

  return (
    <section className="adm-card adm-s-card adm-s-emergency" id="emergency" data-tk="emergency" aria-labelledby="emergency-title">
      <header className="adm-s-head adm-s-head-red">
        <h2 id="emergency-title">Emergency switches</h2>
        <span className="adm-k-help">Work at once and ask you to confirm</span>
      </header>
      <div className="adm-s-body">
        {EMERGENCY_KEYS.map((key) => (
          <div key={key} className="adm-s-switch" data-tk="emergency-switch" data-key={key}>
            <Toggle
              checked={state[key]}
              disabled={!canEdit || busy}
              label={`${EMERGENCY_LABELS[key].title}: ${state[key] ? "On" : "Off"}`}
              onChange={(on) => (on ? setAsking(key) : void change(key, false))}
            />
            <p className="adm-k-help">{EMERGENCY_LABELS[key].hint}</p>
          </div>
        ))}
      </div>
      {asking ? (
        <ReasonDialog
          open
          title={`Turn on: ${EMERGENCY_LABELS[asking].title}?`}
          body={<p>{EMERGENCY_LABELS[asking].confirm} You can turn it off again at any time.</p>}
          confirmLabel="Turn on"
          danger
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            const key = asking;
            setAsking(null);
            void change(key, true);
          }}
        />
      ) : null}
    </section>
  );
}

/** Posting rules: "check ads after they go live". On from now; Ads to review then lists ads published after that moment. */
export function PostModerationCard({ since, canEdit }: { since: string | null; canEdit: boolean }) {
  const answer = useAnswer();
  const [busy, setBusy] = useState(false);

  async function change(on: boolean) {
    setBusy(true);
    const result = await setPostModerationAction({ on });
    setBusy(false);
    answer(result, on ? "Ads are now checked after they go live." : "Ads are no longer checked after they go live.");
  }

  return (
    <section className="adm-card adm-s-card" id="posting" data-tk="post-moderation" aria-labelledby="posting-title">
      <header className="adm-s-head">
        <h2 id="posting-title">Posting rules</h2>
      </header>
      <div className="adm-s-body">
        <Toggle checked={since !== null} disabled={!canEdit || busy} label={since ? "Check ads after they go live: On" : "Check ads after they go live: Off"} onChange={(on) => void change(on)} />
        <p className="adm-k-help">Ads go live first. Ads to review then lists the ads published after the moment you turn this on, so a person can look at them.</p>
        {since ? <p className="adm-k-help" data-tk="post-moderation-since">{`On since ${new Date(since).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} (India time).`}</p> : null}
      </div>
    </section>
  );
}

/** Undo windows: how many days staff can undo each kind of change. Payments, refunds and sent emails can never be undone. */
export function UndoWindowsCard({ windows, canEdit }: { windows: UndoWindows; canEdit: boolean }) {
  return <UndoWindowsForm key={UNDO_WINDOW_KEYS.map((key) => windows[key]).join("-")} windows={windows} canEdit={canEdit} />;
}

function UndoWindowsForm({ windows, canEdit }: { windows: UndoWindows; canEdit: boolean }) {
  const answer = useAnswer();
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(UNDO_WINDOW_KEYS.map((key) => [key, String(windows[key])])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = UNDO_WINDOW_KEYS.some((key) => values[key] !== String(windows[key]));

  async function save() {
    for (const key of UNDO_WINDOW_KEYS) {
      const days = Number(values[key].trim());
      if (values[key].trim() === "" || !Number.isInteger(days) || days < 1 || days > 365) return setError(`${UNDO_WINDOW_LABELS[key]}: days is a whole number from 1 to 365.`);
    }
    setError("");
    setBusy(true);
    const result = await saveUndoWindowsAction(values);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    answer(result, "Undo windows saved.");
  }

  return (
    <section className="adm-card adm-s-card" id="undo" data-tk="undo-windows" aria-labelledby="undo-title">
      <header className="adm-s-head">
        <h2 id="undo-title">Undo windows</h2>
      </header>
      <div className="adm-s-body">
        <p className="adm-k-help">How long staff can undo a change. Payments, refunds and sent emails can never be undone.</p>
        <div className="adm-s-grid">
          {UNDO_WINDOW_KEYS.map((key) => (
            <div key={key} className="adm-k-field">
              <label className="adm-k-label" htmlFor={`undo-${key}`}>{UNDO_WINDOW_LABELS[key]}</label>
              <input
                id={`undo-${key}`}
                className="adm-k-input"
                inputMode="numeric"
                autoComplete="off"
                disabled={!canEdit}
                value={values[key]}
                onChange={(event) => {
                  setValues({ ...values, [key]: event.target.value });
                  setError("");
                }}
              />
              <p className="adm-k-help">days</p>
            </div>
          ))}
        </div>
        {error ? <p className="adm-k-err" role="alert" data-tk="undo-error">{error}</p> : null}
        {canEdit && dirty ? (
          <div className="adm-s-actions">
            <Button kind="quiet" onClick={() => { setValues(Object.fromEntries(UNDO_WINDOW_KEYS.map((key) => [key, String(windows[key])]))); setError(""); }}>Discard</Button>
            <Button kind="primary" busy={busy} onClick={() => void save()}>Save undo windows</Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Search engines: display only. The switch is a server setting and the SEO screen explains it. */
export function SearchEnginesCard({ hidden }: { hidden: boolean }) {
  return (
    <section className="adm-card adm-s-card" id="search" data-tk="search-engines" aria-labelledby="search-title">
      <header className="adm-s-head">
        <h2 id="search-title">Search engines</h2>
      </header>
      <div className="adm-s-body adm-s-row">
        {hidden ? <Badge tone="warn">Hidden from Google</Badge> : <Badge tone="ok">Open to Google</Badge>}
        <p className="adm-k-help" style={{ flex: 1 }}>
          {hidden ? "The site is hidden on purpose until launch. The setting is on the server and stays on until the launch checklist is done." : "Search engines may list the site. Rules for what they may list are in SEO."}
        </p>
        <Link href="/admin/seo/" className="adm-btn adm-btn-quiet">
          <Globe aria-hidden="true" size={16} /> Open SEO
        </Link>
      </div>
    </section>
  );
}
