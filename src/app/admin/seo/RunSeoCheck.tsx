"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Notice } from "@/components/admin/ui";
import { runSeoCheckAction } from "./actions";

export function RunSeoCheck({ canRun, waiting }: { canRun: boolean; waiting: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  function run() {
    setMessage(null);
    start(async () => {
      const out = await runSeoCheckAction();
      if (out.ok) {
        setMessage({ kind: "info", text: `Done. ${out.counts.p0Rows} pages with P0 issues, ${out.counts.p1Rows} with P1 issues.` });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: out.message });
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>
        <button type="button" className="adm-btn" onClick={run} disabled={pending || !canRun}>
          {pending ? "Checking, please wait..." : "Run SEO check now"}
        </button>
      </div>
      {waiting && !message ? <p className="adm-field-help">A check ran in the last 10 minutes; you can run it again after that.</p> : null}
      {!canRun ? <p className="adm-field-help">Only SEO editors and admins can run the check.</p> : null}
      {message ? <Notice kind={message.kind === "error" ? "error" : "info"}>{message.text}</Notice> : null}
    </div>
  );
}
