"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { undoAction } from "@/app/admin/undo-actions";
import type { ChecklistRow } from "@/server/admin/launch-checklist";
import { notJunkAction, tickChecklistAction } from "./actions";

type Note = { kind: "error" | "info"; text: string; eventId?: string };

export function ChecklistCard({ rows }: { rows: ChecklistRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<Note | null>(null);
  const done = rows.filter((row) => row.done).length;

  function toggle(row: ChecklistRow) {
    if (!row.manual) return;
    setNote(null);
    start(async () => {
      const result = await tickChecklistAction(row.manual!, !row.done);
      if (!result.ok) setNote({ kind: "error", text: result.message });
      else router.refresh();
    });
  }

  /** "Keep as is" and "Not junk": one audited change, with an Undo right under the card. */
  function act(run: () => Promise<{ ok: true; eventId: string } | { ok: false; message: string }>, text: string) {
    setNote(null);
    start(async () => {
      const result = await run();
      if (!result.ok) setNote({ kind: "error", text: result.message });
      else {
        setNote({ kind: "info", text, eventId: result.eventId });
        router.refresh();
      }
    });
  }

  function undo(eventId: string) {
    start(async () => {
      const outcome = await undoAction(eventId);
      setNote(outcome.ok ? { kind: "info", text: "Undone." } : { kind: "error", text: outcome.message });
      router.refresh();
    });
  }

  return (
    <section className="adm-card adm-d-card" aria-labelledby="dash-checklist" data-tk="launch-checklist">
      <header className="adm-d-head">
        <h2 id="dash-checklist">Launch checklist</h2>
        <span className="adm-d-pill is-warn">{done} of {rows.length} done</span>
      </header>
      <ul className="adm-d-list">
        {rows.map((row) => (
          <li key={row.id} className="adm-d-row adm-d-check" data-tk={`check-${row.id}`} data-done={row.done ? "yes" : "no"}>
            {row.manual ? (
              <button type="button" className={`adm-d-tick${row.done ? " is-done" : ""}`} role="checkbox" aria-checked={row.done} aria-label={`${row.title}: mark as ${row.done ? "not done" : "done"}`} disabled={pending} onClick={() => toggle(row)}>
                {row.done ? <Check size={14} strokeWidth={3} aria-hidden="true" focusable="false" /> : null}
              </button>
            ) : (
              <span className={`adm-d-tick${row.done ? " is-done" : ""}`} aria-hidden="true">{row.done ? <Check size={14} strokeWidth={3} focusable="false" /> : null}</span>
            )}
            <span className="adm-d-text">
              <strong>{row.title}</strong>
              <small>{row.keep?.kept ? "Kept as is" : row.detail}</small>
              <span className="adm-sr">{row.done ? "Done" : "Not done yet"}</span>
              {row.keep && !row.done ? (
                <button type="button" className="adm-d-keep" data-tk="keep-as-is" disabled={pending} onClick={() => act(() => tickChecklistAction(row.keep!.key, true), "Kept as is. The row is done.")}>
                  Keep as is
                </button>
              ) : null}
              {row.junkAd && !row.done ? (
                <button type="button" className="adm-d-keep" data-tk="not-junk" disabled={pending} onClick={() => act(() => notJunkAction(row.junkAd!.id), `“${row.junkAd!.title.slice(0, 30)}” is no longer flagged as junk.`)}>
                  {`Not junk: ${row.junkAd.title.slice(0, 30)}`}
                </button>
              ) : null}
            </span>
            <Link href={row.href} className="adm-d-open">{row.done ? "View" : "Open"}</Link>
          </li>
        ))}
      </ul>
      {note ? (
        <p className={note.kind === "error" ? "adm-d-error" : "adm-d-note"} role={note.kind === "error" ? "alert" : "status"} data-tk="checklist-note">
          {note.text}{" "}
          {note.eventId ? (
            <button type="button" className="adm-d-keep" data-tk="checklist-undo" disabled={pending} onClick={() => undo(note.eventId as string)}>
              Undo
            </button>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
