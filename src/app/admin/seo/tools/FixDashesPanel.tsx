"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { repairDashesAction } from "./actions";

type Counts = { updated: number; collections: Record<string, number> };

export function FixDashesPanel({ canRun }: { canRun: boolean }) {
  const [pending, start] = useTransition();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const out = await repairDashesAction();
      if (out.ok) {
        setCounts({ updated: out.updated, collections: out.collections });
      } else {
        setCounts(null);
        setError(out.message);
      }
    });
  }

  const rows = counts ? Object.entries(counts.collections) : [];

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>
        <button type="button" className="adm-btn" onClick={run} disabled={pending || !canRun}>
          {pending ? "Fixing, please wait..." : "Fix long dashes"}
        </button>
      </div>
      {!canRun ? <p className="adm-field-help">Only a superadmin can run this fix.</p> : null}
      {counts ? (
        <div style={{ display: "grid", gap: 4 }} aria-live="polite">
          <p style={{ margin: 0 }}>
            {counts.updated === 0 ? "Nothing to fix. No stored text had a long dash." : `Fixed ${counts.updated} stored documents.`}
          </p>
          {rows.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {rows.map(([name, count]) => (
                <li key={name}>
                  {name}: {count}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
    </div>
  );
}
