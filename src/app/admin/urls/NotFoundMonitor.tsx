"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DataTable, Notice, type Column } from "@/components/admin/ui";
import { createRedirectFrom404Action } from "./notfound-actions";

export interface NotFoundView {
  path: string;
  hits: number;
  botHits: number;
  humanHits: number;
  refDomain: string;
  lastDay: string;
  redirected: boolean;
}

type Who = "all" | "human" | "bot";

export function NotFoundMonitor({ rows, days }: { rows: NotFoundView[]; days: number }) {
  const router = useRouter();
  const [who, setWho] = useState<Who>("all");
  const [target, setTarget] = useState<{ path: string; to: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();

  const shown = rows.filter((row) => (who === "human" ? row.humanHits > 0 : who === "bot" ? row.botHits > 0 : true));
  const columns: Column<NotFoundView>[] = [
    { key: "path", label: "Missing path", sortable: true },
    { key: "hits", label: "Hits", sortable: true },
    { key: "humanHits", label: "People", sortable: true },
    { key: "botHits", label: "Bots", sortable: true },
    { key: "refDomain", label: "Came from" },
    { key: "lastDay", label: "Last seen", sortable: true },
    {
      key: "action",
      label: "Fix",
      value: (row) => (row.redirected ? "redirected" : ""),
      render: (row) =>
        row.redirected ? (
          "Redirect exists"
        ) : (
          <button type="button" className="adm-btn adm-btn-quiet" style={{ minHeight: 36 }} onClick={() => setTarget({ path: row.path, to: "" })}>
            Create 301 to...
          </button>
        ),
    },
  ];

  function create() {
    if (!target) return;
    start(async () => {
      const out = await createRedirectFrom404Action(target.path, target.to);
      setMessage(out.ok ? `Redirect created: ${target.path} to ${target.to}` : out.message);
      if (out.ok) {
        setTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="adm-stack">
      <p className="adm-field-help" style={{ margin: 0 }}>
        Pages that visitors or bots asked for and did not find, for the last {days} days. Fix the ones that matter by redirecting them to the right page.
      </p>
      <label className="adm-field" style={{ maxWidth: 240 }}>
        <span className="adm-field-label">Who asked</span>
        <select className="adm-input" value={who} onChange={(event) => setWho(event.target.value as Who)}>
          <option value="all">People and bots</option>
          <option value="human">People</option>
          <option value="bot">Bots</option>
        </select>
      </label>
      {target ? (
        <section className="adm-card" style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0 }}>
            Send <strong>{target.path}</strong> to:
          </p>
          <input className="adm-input" value={target.to} placeholder="/jobs/pune/" onChange={(event) => setTarget({ ...target, to: event.target.value })} aria-label="New address" />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="adm-btn" onClick={create} disabled={busy || !target.to.trim()}>
              Create redirect
            </button>
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setTarget(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}
      {message ? <Notice kind="info">{message}</Notice> : null}
      <DataTable columns={columns} rows={shown} rowKey={(row) => row.path} csvName="seo-404" emptyText="No 404 hits recorded yet" />
    </div>
  );
}
