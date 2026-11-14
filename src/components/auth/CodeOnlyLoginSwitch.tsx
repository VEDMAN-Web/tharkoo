"use client";

import { useState } from "react";
import { Notice, Toggle } from "@/components/admin/ui";
import { saveCodeOnlyLoginAction } from "@/components/auth/code-only-actions";

type Banner = { kind: "error" | "info"; text: string };

/** H7.2b: superadmin only. Users and sellers sign in with an emailed code only. Staff passwords are not changed. */
export function CodeOnlyLoginSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setNotice(null);
    const result = await saveCodeOnlyLoginAction(next);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.error });
    setOn(result.enabled);
    setNotice({
      kind: "info",
      text: result.enabled
        ? "Saved. Users and sellers can no longer log in or reset a password. Staff passwords still work."
        : "Saved. Users and sellers can log in with a password again.",
    });
  }

  return (
    <section className="mb-3" aria-labelledby="code-only-title">
      <h2 className="t-h3" id="code-only-title">Code-only login</h2>
      <p className="t-small text-muted">
        When on, users and sellers sign in with a one-time emailed code and never with a password. Staff and admin passwords are not changed.
        Every change is recorded in the audit log.
      </p>
      <Toggle checked={on} onChange={change} label="Code-only login for users and sellers" disabled={busy} />
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </section>
  );
}
