"use client";

import { useState } from "react";
import { Notice, Toggle } from "@/components/admin/ui";
import type { LaunchSwitches } from "@/server/wallet/launch-switches";
import { saveLaunchSwitchAction } from "./launch-actions";

type Banner = { kind: "error" | "info"; text: string };

export function LaunchSwitchesForm({ initial }: { initial: LaunchSwitches }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Banner | null>(null);

  async function change(name: keyof LaunchSwitches, on: boolean) {
    setBusy(true);
    setNotice(null);
    const result = await saveLaunchSwitchAction(name, on);
    setBusy(false);
    if (!result.ok) return setNotice({ kind: "error", text: result.error });
    setState(result.switches);
    setNotice({ kind: "info", text: on ? "Saved. This is now on for visitors." : "Saved. Visitors see Coming soon." });
  }

  return (
    <section className="mb-3" aria-labelledby="launch-switches-title" data-tk="launch-switches">
      <h2 className="t-h3" id="launch-switches-title">Launch switches</h2>
      <p className="t-small text-muted">
        Off shows a Coming soon pill and the server refuses the action. Turn each on only when its provider keys are in place. Every change is recorded in the audit log.
      </p>
      <Toggle checked={state.creditPurchasesOn} onChange={(on) => change("creditPurchasesOn", on)} label="Credit purchases: On (off is Coming soon)" disabled={busy} />
      <Toggle checked={state.videoCallsOn} onChange={(on) => change("videoCallsOn", on)} label="Video calls: On (off is Coming soon)" disabled={busy} />
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
    </section>
  );
}
