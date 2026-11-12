"use client";

import { useEffect, useState } from "react";
import { revisionsAction } from "@/app/admin/layout-actions";
import type { PageKey } from "@/server/models/layout";
import { Notice } from "../ui/Notice";
import { Skeleton } from "../ui/Skeleton";

interface Revision {
  version: number;
  publishedBy: string;
  publishedAt: Date | string;
  note: string;
}

const when = (value: Date | string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

/** Side drawer listing published versions. Restore puts a version into the draft (publish again to make it live). */
export function RevisionsDrawer({
  pageKey,
  scope,
  dirty,
  busy,
  onRestore,
  onClose,
}: {
  pageKey: PageKey;
  scope: string;
  dirty: boolean;
  busy: boolean;
  onRestore: (version: number) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Revision[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    revisionsAction(pageKey, scope).then((res) => {
      if (cancelled) return;
      if (res.ok) setRows(res.revisions);
      else {
        setError(res.error);
        setRows([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pageKey, scope]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="adm-dialog-back lay-drawer-back" onClick={onClose}>
      <aside className="lay-drawer" role="dialog" aria-modal="true" aria-label="Revisions" onClick={(event) => event.stopPropagation()}>
        <div className="lay-drawer-head">
          <h2>Revisions</h2>
          <button type="button" className="adm-btn adm-btn-quiet" onClick={onClose}>Close</button>
        </div>
        <p className="adm-field-help">Every publish is kept. Restore copies a version into your draft; publish it to make it live.</p>
        {dirty ? <Notice kind="warn">You have unsaved changes. Restoring replaces them.</Notice> : null}
        {error ? <Notice kind="error">{error}</Notice> : null}
        {rows === null ? <Skeleton lines={4} /> : null}
        {rows && rows.length === 0 && !error ? <p>Nothing has been published yet.</p> : null}
        <ul className="lay-revs">
          {(rows ?? []).map((row) => (
            <li key={row.version} className="lay-rev">
              <div>
                <strong>Version {row.version}</strong>
                <div className="adm-field-help">{when(row.publishedAt)}{row.publishedBy ? ` by ${row.publishedBy}` : ""}</div>
                {row.note ? <div>{row.note}</div> : null}
              </div>
              {pending === row.version ? (
                <span className="lay-rev-actions">
                  <button type="button" className="adm-btn" disabled={busy} onClick={() => { setPending(null); onRestore(row.version); }}>
                    Yes, restore v{row.version}
                  </button>
                  <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setPending(null)}>No</button>
                </span>
              ) : (
                <button type="button" className="adm-btn adm-btn-ghost" disabled={busy} onClick={() => setPending(row.version)}>
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
