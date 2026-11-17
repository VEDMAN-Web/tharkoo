"use client";

import { useState } from "react";
import { Badge } from "@/components/admin/ui/Badge";
import { Button } from "@/components/admin/ui/Button";
import type { HomeBuilderState } from "@/server/layout/home-builder";

const SHORT = 3;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export function Versions({ state, busy, onRestore }: { state: Pick<HomeBuilderState, "revisions" | "liveVersion">; busy: boolean; onRestore: (version: number) => void }) {
  const [all, setAll] = useState(false);
  const rows = all ? state.revisions : state.revisions.slice(0, SHORT);
  return (
    <section className="adm-card adm-pb-card" id="versions" aria-labelledby="pb-versions" data-tk="versions">
      <header className="adm-pb-head">
        <h2 id="pb-versions">Versions</h2>
        {state.revisions.length > SHORT ? (
          <Button kind="quiet" size="sm" onClick={() => setAll(!all)}>
            {all ? "Show fewer" : "All versions"}
          </Button>
        ) : null}
      </header>
      {rows.length === 0 ? <p className="adm-pb-note">Nothing was published from here yet.</p> : null}
      <ul className="adm-pb-versions">
        {rows.map((row) => {
          const live = row.version === state.liveVersion;
          return (
            <li key={row.version} data-tk={live ? "version-live" : "version"}>
              <span className="adm-pb-vtext">
                <strong>v{row.version}</strong> {live ? <Badge tone="ok" dot>Live</Badge> : null}
                <small>
                  {row.publishedBy} · {when(row.publishedAt)}
                  {row.note ? ` · ${row.note}` : ""}
                </small>
              </span>
              {live ? null : (
                <Button size="sm" disabled={busy} onClick={() => onRestore(row.version)}>
                  Restore
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
