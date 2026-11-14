"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, friendlyError, type ApiError } from "@/lib/ui/api";
import { Notice } from "@/components/admin/ui";
import { SCREENSHOT_ACCEPT, SCREENSHOT_LIMIT_TEXT } from "./labels";
import { postForm } from "./request";
import { STATUS_LABELS } from "@/server/support/constants";

export interface StaffOption {
  id: string;
  name: string;
}

interface DeskThreadProps {
  ticketId: string;
  status: string;
  closed: boolean;
  staff: StaffOption[];
  viewerId: string;
}

type Outcome = { kind: "info" | "error"; text: string } | null;

const STATUS_CHOICES = ["open", "waiting_for_user", "waiting_for_support"] as const;

/** Staff actions on one ticket. Each write goes through the desk API, which checks the role and writes an audit row. */
export function DeskThread({ ticketId, status, closed, staff, viewerId }: DeskThreadProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);

  async function run(job: () => Promise<{ ok: true } | { ok: false; error: ApiError }>, done: string) {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    const res = await job();
    setBusy(false);
    if (res.ok) {
      setOutcome({ kind: "info", text: done });
      router.refresh();
    } else setOutcome({ kind: "error", text: friendlyError(res.error) });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {outcome ? <Notice kind={outcome.kind === "error" ? "error" : "info"}>{outcome.text}</Notice> : null}
      <Reply ticketId={ticketId} closed={closed} busy={busy} onSend={(job, done) => run(job, done)} />
      <div className="adm-card" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", alignItems: "end" }}>
        <StatusControl ticketId={ticketId} status={status} closed={closed} busy={busy} onRun={(job, done) => run(job, done)} />
        <AssignControl ticketId={ticketId} staff={staff} viewerId={viewerId} busy={busy} onRun={(job, done) => run(job, done)} />
        <CloseControl ticketId={ticketId} closed={closed} busy={busy} onRun={(job, done) => run(job, done)} />
      </div>
    </div>
  );
}

type Run = (job: () => Promise<{ ok: true } | { ok: false; error: ApiError }>, done: string) => Promise<void>;

async function call(path: string, body?: unknown): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  const res = await api(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

function Reply({ ticketId, closed, busy, onSend }: { ticketId: string; closed: boolean; busy: boolean; onSend: Run }) {
  const [body, setBody] = useState("");
  const [note, setNote] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() && files.length === 0) return setError("Write a reply or attach a screenshot.");
    setError("");
    const form = new FormData();
    form.append("body", body);
    form.append("internal", note ? "true" : "false");
    for (const file of files) form.append("screenshots", file);
    await onSend(async () => {
      const res = await postForm(`/api/admin/support/tickets/${ticketId}/messages`, form);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    }, note ? "Internal note saved. The customer cannot see it." : "Reply sent to the customer.");
    setBody("");
    setFiles([]);
    setNote(false);
  }

  return (
    <form onSubmit={send} className="adm-card" aria-label="Reply or note" style={{ display: "grid", gap: 12 }}>
      <label className="adm-field">
        <span className="adm-field-label">{note ? "Internal note (staff only)" : "Reply to the customer"}</span>
        <textarea className="adm-input" rows={4} maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} disabled={busy || (closed && !note)} />
      </label>
      <label className="adm-field" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={note} onChange={(event) => setNote(event.target.checked)} />
        <span>Save as internal note (the customer will not see it)</span>
      </label>
      <label className="adm-field">
        <span className="adm-field-label">Screenshots (optional)</span>
        <input type="file" multiple accept={SCREENSHOT_ACCEPT} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} aria-describedby="desk-shots-help" />
        <span id="desk-shots-help" className="adm-field-help">{SCREENSHOT_LIMIT_TEXT}</span>
      </label>
      {error ? <p role="alert" className="adm-field-error">{error}</p> : null}
      {closed && !note ? <p className="adm-field-help">This ticket is closed. Reopen it to reply to the customer, or save an internal note.</p> : null}
      <div>
        <button type="submit" className="adm-btn" disabled={busy}>{note ? "Save note" : "Send reply"}</button>
      </div>
    </form>
  );
}

function StatusControl({ ticketId, status, closed, busy, onRun }: { ticketId: string; status: string; closed: boolean; busy: boolean; onRun: Run }) {
  const [next, setNext] = useState<string>(status);
  return (
    <form
      className="adm-field"
      aria-label="Change status"
      onSubmit={(event) => {
        event.preventDefault();
        void onRun(() => call(`/api/admin/support/tickets/${ticketId}/status`, { status: next }), "Status changed.");
      }}
    >
      <label className="adm-field-label" htmlFor="desk-status">Status</label>
      <select id="desk-status" className="adm-input" value={next} onChange={(event) => setNext(event.target.value)} disabled={busy || closed}>
        {closed ? <option value="closed">{STATUS_LABELS.closed}</option> : null}
        {STATUS_CHOICES.map((value) => (
          <option key={value} value={value}>{STATUS_LABELS[value]}</option>
        ))}
      </select>
      <button type="submit" className="adm-btn adm-btn-ghost" disabled={busy || closed || next === status}>Set status</button>
    </form>
  );
}

function AssignControl({ ticketId, staff, viewerId, busy, onRun }: { ticketId: string; staff: StaffOption[]; viewerId: string; busy: boolean; onRun: Run }) {
  const [choice, setChoice] = useState("none");
  return (
    <form
      className="adm-field"
      aria-label="Assign"
      onSubmit={(event) => {
        event.preventDefault();
        const assigneeId = choice === viewerId ? "me" : choice;
        void onRun(() => call(`/api/admin/support/tickets/${ticketId}/assign`, { assigneeId }), "Assignment saved.");
      }}
    >
      <label className="adm-field-label" htmlFor="desk-assign">Assigned to</label>
      <select id="desk-assign" className="adm-input" value={choice} onChange={(event) => setChoice(event.target.value)} disabled={busy}>
        <option value="none">Nobody</option>
        {staff.map((person) => (
          <option key={person.id} value={person.id}>{person.id === viewerId ? `${person.name} (me)` : person.name}</option>
        ))}
      </select>
      <button type="submit" className="adm-btn adm-btn-ghost" disabled={busy}>Save assignment</button>
    </form>
  );
}

function CloseControl({ ticketId, closed, busy, onRun }: { ticketId: string; closed: boolean; busy: boolean; onRun: Run }) {
  const [asking, setAsking] = useState(false);
  if (closed) {
    return (
      <div className="adm-field">
        <span className="adm-field-label">This ticket is closed</span>
        <button type="button" className="adm-btn" disabled={busy} onClick={() => void onRun(() => call(`/api/admin/support/tickets/${ticketId}/reopen`), "Ticket reopened.")}>
          Reopen ticket
        </button>
      </div>
    );
  }
  if (!asking) {
    return (
      <div className="adm-field">
        <span className="adm-field-label">Finished?</span>
        <button type="button" className="adm-btn adm-btn-danger" disabled={busy} onClick={() => setAsking(true)}>Close ticket</button>
      </div>
    );
  }
  return (
    <div className="adm-field" role="group" aria-label="Confirm close">
      <span className="adm-field-help">The customer can still read this ticket, but cannot reply.</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="adm-btn adm-btn-danger" disabled={busy} onClick={() => void onRun(() => call(`/api/admin/support/tickets/${ticketId}/close`), "Ticket closed.")}>
          Confirm close
        </button>
        <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setAsking(false)}>Cancel</button>
      </div>
    </div>
  );
}
