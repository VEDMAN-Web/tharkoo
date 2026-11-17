"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Badge, Button, Notice, ReasonDialog, Toggle, useToast } from "@/components/admin/ui";
import { SCREENSHOT_ACCEPT, SCREENSHOT_LIMIT_TEXT, StatusChip, ageLabel, formatWhen } from "@/components/support/labels";
import { postForm } from "@/components/support/request";
import { api, friendlyError, type ApiError } from "@/lib/ui/api";
import type { MessageView, TicketSummary } from "@/server/support/records";
import type { TicketOrder } from "./data";
import { REPLY_TEMPLATES, fillTemplate } from "./templates";

type Staff = { id: string; name: string };
type Outcome = { kind: "info" | "error"; text: string } | null;
const OVER_HOURS = 4;

type Answer = { ok: true; data: unknown } | { ok: false; error: ApiError };

async function call(path: string, body?: unknown): Promise<Answer> {
  const res = await api(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
}

/** The middle pane: the ticket, its messages, the order it is about, ready-made replies and the reply box. */
export function ThreadPane({
  ticket,
  customer,
  messages,
  staff,
  viewerId,
  order,
  now,
}: {
  ticket: TicketSummary;
  customer: string;
  messages: MessageView[];
  staff: Staff[];
  viewerId: string;
  order: TicketOrder | null;
  now: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirmClose, setConfirmClose] = useState(false);
  const [body, setBody] = useState("");
  const [note, setNote] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  const [assignee, setAssignee] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const closed = ticket.status === "closed";
  const hoursWaiting = (now - new Date(ticket.lastCustomerMessageAt).getTime()) / 3_600_000;
  const over = ticket.status === "waiting_for_support" && hoursWaiting >= OVER_HOURS;

  async function send(andClose: boolean) {
    if (busy) return;
    if (!body.trim() && files.length === 0) return setError("Write a reply or attach a screenshot.");
    setError("");
    setBusy(true);
    setOutcome(null);
    const form = new FormData();
    form.append("body", body);
    form.append("internal", note ? "true" : "false");
    for (const file of files) form.append("screenshots", file);
    const sent = await postForm(`/api/admin/support/tickets/${ticket.id}/messages`, form);
    if (!sent.ok) {
      setBusy(false);
      return setOutcome({ kind: "error", text: friendlyError(sent.error) });
    }
    let text = note ? "Internal note saved. The customer cannot see it." : "Reply sent to the customer.";
    if (andClose && !note) {
      const closedNow = await call(`/api/admin/support/tickets/${ticket.id}/close`);
      if (!closedNow.ok) {
        setBusy(false);
        return setOutcome({ kind: "error", text: `The reply was sent, but the ticket was not closed: ${friendlyError(closedNow.error)}` });
      }
      text = "Reply sent and ticket closed.";
    }
    setBusy(false);
    setBody("");
    setFiles([]);
    setNote(false);
    setOutcome({ kind: "info", text });
    router.refresh();
  }

  async function assign(next: string) {
    setAssignee(next);
    setBusy(true);
    const result = await call(`/api/admin/support/tickets/${ticket.id}/assign`, { assigneeId: next === viewerId ? "me" : next });
    setBusy(false);
    setOutcome(result.ok ? { kind: "info", text: "Assignment saved." } : { kind: "error", text: friendlyError(result.error) });
    if (result.ok) router.refresh();
  }

  /** Close with no reply. The customer is not emailed. An optional internal note is kept for the team. Undo puts the ticket back where it was. */
  async function closeSilently(noteText: string) {
    setConfirmClose(false);
    setBusy(true);
    setOutcome(null);
    if (noteText.trim()) {
      const form = new FormData();
      form.append("body", noteText.trim());
      form.append("internal", "true");
      const saved = await postForm(`/api/admin/support/tickets/${ticket.id}/messages`, form);
      if (!saved.ok) {
        setBusy(false);
        return setOutcome({ kind: "error", text: `The note was not saved, so the ticket was not closed: ${friendlyError(saved.error)}` });
      }
    }
    const result = await call(`/api/admin/support/tickets/${ticket.id}/close`);
    setBusy(false);
    if (!result.ok) return setOutcome({ kind: "error", text: friendlyError(result.error) });
    const before = (result.data as { before?: string } | null)?.before ?? "open";
    toast.show({ kind: "undo", message: `Ticket #${ticket.number} closed. The customer was not emailed.`, onUndo: () => void undoClose(before) });
    router.refresh();
  }

  async function undoClose(before: string) {
    const back = await call(`/api/admin/support/tickets/${ticket.id}/reopen`);
    if (!back.ok) return toast.show({ kind: "error", message: friendlyError(back.error) });
    if (before !== "open" && before !== "closed") await call(`/api/admin/support/tickets/${ticket.id}/status`, { status: before });
    toast.show({ kind: "success", message: "Ticket reopened." });
    router.refresh();
  }

  async function reopen() {
    setBusy(true);
    const result = await call(`/api/admin/support/tickets/${ticket.id}/reopen`);
    setBusy(false);
    setOutcome(result.ok ? { kind: "info", text: "Ticket reopened." } : { kind: "error", text: friendlyError(result.error) });
    if (result.ok) router.refresh();
  }

  return (
    <section className="adm-card adm-sd-thread" aria-label="Ticket" data-tk="desk-thread">
      <header className="adm-sd-thead">
        <div className="adm-sd-ttitle">
          <h2>{ticket.subject}</h2>
          <p className="adm-k-help">{`${customer} · opened ${formatWhen(ticket.lastMessageAt)} · #${ticket.number}`}</p>
        </div>
        <div className="adm-sd-tbadges">
          {over ? <Badge tone="bad">{`Over ${OVER_HOURS} h`}</Badge> : null}
          <StatusChip status={ticket.status} label={ticket.statusLabel} />
          <label className="adm-k-sr" htmlFor="desk-assign">Assigned to</label>
          <select id="desk-assign" className="adm-k-select" value={assignee} onChange={(event) => void assign(event.target.value)} disabled={busy || closed}>
            <option value="" disabled>{ticket.assigned ? "Assigned" : "Assign to..."}</option>
            <option value="none">Nobody</option>
            {staff.map((person) => (
              <option key={person.id} value={person.id}>{person.id === viewerId ? `${person.name} (me)` : person.name}</option>
            ))}
          </select>
          {closed ? null : (
            <Button size="sm" busy={busy} onClick={() => setConfirmClose(true)}>
              Close ticket
            </Button>
          )}
        </div>
      </header>
      <ReasonDialog
        open={confirmClose}
        title="Close without replying?"
        body="The customer is not emailed. You can reopen the ticket any time."
        textLabel="Internal note (optional, staff only)"
        confirmLabel="Close ticket"
        onConfirm={(result) => void closeSilently(result.text)}
        onCancel={() => setConfirmClose(false)}
      />

      <ol className="adm-sd-messages" aria-label="Messages">
        {messages.map((message) => (
          <li key={message.id} className="adm-sd-msg" data-tk="desk-message" data-from={message.authorType} data-internal={message.internal ? "true" : "false"}>
            <strong>{message.internal ? "Internal note (staff only)" : message.authorType === "staff" ? "Support" : customer}</strong>
            {message.body ? <p>{message.body}</p> : null}
            {message.attachments.length ? (
              <span className="adm-sd-files">
                {message.attachments.map((id, index) => (
                  <a key={id} href={`/api/support/attachments/${id}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/support/attachments/${id}`} alt={`Screenshot ${index + 1}`} loading="lazy" />
                  </a>
                ))}
              </span>
            ) : null}
            <small>{formatWhen(message.createdAt)}</small>
          </li>
        ))}
      </ol>

      {order ? (
        <div className="adm-sd-order" data-tk="desk-order">
          <span>{order.text}</span>
          {order.receipt ? (
            <Button size="sm" href={order.receipt} target="_blank" rel="noopener">
              Open receipt
            </Button>
          ) : null}
        </div>
      ) : null}

      {outcome ? <Notice kind={outcome.kind === "error" ? "error" : "info"}>{outcome.text}</Notice> : null}

      {closed ? (
        <div className="adm-sd-closed">
          <p className="adm-k-help">This ticket is closed. Reopen it to reply to the customer, or save an internal note.</p>
          <Button kind="primary" busy={busy} onClick={() => void reopen()}>
            Reopen ticket
          </Button>
        </div>
      ) : (
        <form
          className="adm-sd-compose"
          aria-label="Reply or note"
          onSubmit={(event) => {
            event.preventDefault();
            void send(false);
          }}
        >
          <div className="adm-sd-chips" role="group" aria-label="Ready-made replies">
            {REPLY_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                className="adm-k-chip"
                onClick={() => {
                  setBody(fillTemplate(template.key, customer));
                  area.current?.focus();
                }}
              >
                {template.label}
              </button>
            ))}
          </div>
          <label className="adm-k-label" htmlFor="desk-body">{note ? "Internal note (staff only)" : "Reply to the customer"}</label>
          <textarea
            id="desk-body"
            ref={area}
            className="adm-k-input"
            rows={4}
            maxLength={4000}
            value={body}
            disabled={busy}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void send(!note);
              }
            }}
          />
          <Toggle checked={note} onChange={setNote} label="Internal note (the user does not see it)" disabled={busy} />
          <details className="adm-sd-shots">
            <summary>Add screenshots</summary>
            <input type="file" multiple accept={SCREENSHOT_ACCEPT} onChange={(event) => setFiles(Array.from(event.target.files ?? []))} aria-label="Screenshots" />
            <span className="adm-k-help">{SCREENSHOT_LIMIT_TEXT}</span>
          </details>
          {error ? (
            <p className="adm-k-err" role="alert" data-tk="desk-error">
              {error}
            </p>
          ) : null}
          <div className="adm-sd-sendbar">
            <Button busy={busy} onClick={() => void send(false)}>
              {note ? "Save note" : "Send and keep open"}
            </Button>
            <span className="adm-k-sp" />
            {note ? null : (
              <Button kind="primary" icon={Send} busy={busy} onClick={() => void send(true)}>
                Send and close
              </Button>
            )}
          </div>
          <p className="adm-k-help">{`Last customer message ${ageLabel(ticket.lastCustomerMessageAt, now)} ago. Ctrl Enter sends and closes.`}</p>
        </form>
      )}
    </section>
  );
}
