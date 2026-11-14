"use client";

import { useState } from "react";
import { Notice, Toggle } from "@/components/admin/ui";
import { saveNewDesignAction } from "./new-design-actions";

type Banner = { kind: "error" | "info"; text: string };

/** H7.1: superadmin only. The pastel "New design" for the public site. Off keeps the old design, one click rolls back. */
export function NewDesignSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setNotice(null);
    const result = await saveNewDesignAction(next);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.error });
    setOn(result.on);
    setNotice({
      kind: "info",
      text: result.on
        ? "Saved. Visitors see the New design: new header, footer and support chat."
        : "Saved. Visitors see the old design again.",
    });
  }

  return (
    <section className="mb-3" aria-labelledby="new-design-title">
      <h2 className="t-h3" id="new-design-title">New design</h2>
      <p className="t-small text-muted">
        The new header, footer and live chat. Off is the old design and a one-click rollback. Every change is recorded in the audit log.
      </p>
      <Toggle checked={on} onChange={change} label="Show the New design to visitors" disabled={busy} />
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </section>
  );
}
