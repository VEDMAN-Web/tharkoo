"use client";

import { useState } from "react";
import { Notice, Toggle } from "@/components/admin/ui";
import { saveRtaLabelAction } from "./rta-actions";
import { SettingItem } from "./_view/SettingItem";

type Banner = { kind: "error" | "info"; text: string };

/** H17.13: admins. The RTA ("Restricted To Adults") label: a meta tag on every page and a small RTA link in the footer. On by default. */
export function RtaLabelSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function change(next: boolean) {
    setBusy(true);
    setNotice(null);
    const result = await saveRtaLabelAction(next);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.message });
    setOn(result.on);
    setNotice({ kind: "info", text: result.on ? "Saved. Pages carry the RTA label and the footer shows the RTA link." : "Saved. The RTA label and the footer link are off." });
  }

  return (
    <SettingItem
      id="rta-label-title"
      title="RTA label"
      help="Marks the site as Restricted To Adults so parental-control filters can recognise it: a RATING meta tag in the head of every page and a small RTA link in the footer. Every change is recorded in the audit log and can be undone."
    >
      <Toggle checked={on} onChange={change} label="Show the RTA label" disabled={busy} />
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </SettingItem>
  );
}
