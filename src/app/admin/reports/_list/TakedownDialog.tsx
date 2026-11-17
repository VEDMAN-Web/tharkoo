"use client";

import { useState } from "react";
import { Button, TextField } from "@/components/admin/ui";
import { FormDialog } from "@/app/admin/_catalog/FormDialog";
import "@/app/admin/_catalog/catalog.css";
import { DEFAULT_DUE_HOURS } from "@/server/admin/takedown-rules";
import { addTakedownAction } from "../_actions/takedown";

const HOUR_MS = 3_600_000;
const pad = (value: number) => String(value).padStart(2, "0");

/** The value a date-time box wants, in the browser's own time: 2026-11-18T14:30. */
export function localInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Due time that goes with a received time: 36 hours later, unless staff chose their own. */
export function defaultDue(received: string): string {
  const date = new Date(received);
  return Number.isNaN(date.getTime()) ? "" : localInput(new Date(date.getTime() + DEFAULT_DUE_HOURS * HOUR_MS));
}

/** "Add takedown" on the Legal takedown tab: where the request is about, who asked, how it arrived, why, when it came and when it is due. */
export function TakedownDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [ad, setAd] = useState("");
  const [askedBy, setAskedBy] = useState("");
  const [channel, setChannel] = useState("email");
  const [reason, setReason] = useState("");
  const [received, setReceived] = useState(() => localInput(new Date()));
  const [due, setDue] = useState(() => defaultDue(localInput(new Date())));
  const [dueTouched, setDueTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    const now = localInput(new Date());
    setAd("");
    setAskedBy("");
    setChannel("email");
    setReason("");
    setReceived(now);
    setDue(defaultDue(now));
    setDueTouched(false);
    setError("");
  }

  const close = () => {
    reset();
    onClose();
  };

  async function add() {
    setBusy(true);
    setError("");
    const result = await addTakedownAction({ ad, askedBy, channel, reason, receivedAt: received ? new Date(received).toISOString() : "", dueAt: due ? new Date(due).toISOString() : "" });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    reset();
    onAdded();
  }

  return (
    <FormDialog
      open={open}
      title="Add takedown"
      intro="Use this for a legal request that came by email or letter. It goes into this list with its due time."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void add()}>Add takedown</Button>
        </>
      }
    >
      <TextField label="Ad (link or ID)" required value={ad} onChange={(next) => { setAd(next); setError(""); }} />
      <TextField label="Who asked" required max={120} value={askedBy} onChange={(next) => { setAskedBy(next); setError(""); }} />
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="takedown-channel">How it arrived</label>
        <select id="takedown-channel" className="adm-k-input" value={channel} onChange={(event) => setChannel(event.target.value)}>
          <option value="email">Email</option>
          <option value="letter">Letter</option>
          <option value="other">Other</option>
        </select>
      </div>
      <TextField label="Reason" required multiline max={1000} value={reason} onChange={(next) => { setReason(next); setError(""); }} />
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="takedown-received">Received on</label>
        <input id="takedown-received" className="adm-k-input" type="datetime-local" value={received} onChange={(event) => { setReceived(event.target.value); if (!dueTouched) setDue(defaultDue(event.target.value)); setError(""); }} />
      </div>
      <div className="adm-cat-field">
        <label className="adm-k-label" htmlFor="takedown-due">Due by</label>
        <input id="takedown-due" className="adm-k-input" type="datetime-local" value={due} aria-describedby="takedown-due-help" onChange={(event) => { setDue(event.target.value); setDueTouched(true); setError(""); }} />
        <p className="adm-k-help" id="takedown-due-help">{`Starts ${DEFAULT_DUE_HOURS} hours after it was received. Change it if the request names another time.`}</p>
      </div>
      {error ? <p className="adm-k-err" role="alert" data-tk="takedown-error">{error}</p> : null}
    </FormDialog>
  );
}
