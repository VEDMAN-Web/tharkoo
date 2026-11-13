"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Notice } from "@/components/admin/ui/Notice";
import { Skeleton } from "@/components/admin/ui/Skeleton";
import { dismissVideoReportsAction, listVideosAction, removeVideoAction } from "./video-actions";

type Row = {
  id: string;
  url: string;
  posterUrl: string | null;
  listingId: string;
  openReports: number;
  hidden: boolean;
  createdAt: string;
};

/** Ad videos: reported ones first. A video with 3 or more open reports stays hidden from visitors until it is reviewed here. */
export function VideoReview() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const res = await listVideosAction();
    if (!res.ok) {
      setError(res.error);
      setRows([]);
      return;
    }
    setError("");
    setRows(res.videos as Row[]);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function remove() {
    if (!removing) return;
    const res = await removeVideoAction(removing.id);
    if (!res.ok) setError(res.error);
    setRemoving(null);
    void load();
  }

  async function keep(row: Row) {
    const res = await dismissVideoReportsAction(row.listingId);
    if (!res.ok) setError(res.error);
    void load();
  }

  return (
    <section className="adm-card" style={{ display: "grid", gap: 12 }} aria-label="Ad videos">
      <h2 style={{ fontSize: 16, fontWeight: 800 }}>Ad videos{rows ? ` (${rows.length})` : ""}</h2>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {rows === null ? (
        <Skeleton lines={3} />
      ) : rows.length === 0 ? (
        <EmptyState title="No ad videos yet" why="Videos uploaded by advertisers appear here. Removing one is audited." />
      ) : (
        <div className="adm-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {rows.map((row) => (
            <article key={row.id} className="adm-card" style={{ display: "grid", gap: 8 }}>
              <video src={row.url} poster={row.posterUrl || undefined} controls muted preload="metadata" playsInline style={{ width: "100%", maxHeight: 240, background: "#000" }} />
              <p style={{ fontSize: 13, color: "var(--adm-muted)" }}>
                {row.openReports} open report{row.openReports === 1 ? "" : "s"}
                {row.hidden ? " - hidden from visitors" : ""}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setRemoving(row)}>
                  Remove video
                </button>
                {row.openReports > 0 ? (
                  <button type="button" className="adm-btn adm-btn-quiet" onClick={() => void keep(row)}>
                    Keep and clear reports
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this video?"
        body="The video file is deleted and its reports are closed. The ad and its photos stay. This is recorded in the audit log."
        confirmText="remove"
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </section>
  );
}
