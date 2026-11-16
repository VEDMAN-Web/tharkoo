"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { ChecklistRow } from "@/server/admin/launch-checklist";
import { tickChecklistAction } from "./actions";

export function ChecklistCard({ rows }: { rows: ChecklistRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const done = rows.filter((row) => row.done).length;

  function toggle(row: ChecklistRow) {
    if (!row.manual) return;
    setNote("");
    start(async () => {
      const result = await tickChecklistAction(row.manual!, !row.done);
      if (!result.ok) setNote(result.message);
      else router.refresh();
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
              <small>{row.detail}</small>
              <span className="adm-sr">{row.done ? "Done" : "Not done yet"}</span>
            </span>
            <Link href={row.href} className="adm-d-open">{row.done ? "View" : "Open"}</Link>
          </li>
        ))}
      </ul>
      {note ? <p className="adm-d-error" role="alert">{note}</p> : null}
    </section>
  );
}
