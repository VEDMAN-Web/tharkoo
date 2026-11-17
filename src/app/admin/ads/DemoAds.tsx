"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { History, Power } from "lucide-react";
import { Button, ReasonDialog, useToast } from "@/components/admin/ui";
import type { DemoPanelData } from "@/server/listings/demo-ads";
import { endDemoAdsAction, restoreDemoAdsAction, undoEndDemoAdsAction } from "./demo-actions";

function dayOf(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** The Demo ads tab panel (H8.30): how many are live, End with a typed confirm, and Restore for a superadmin in the days after. */
export function DemoAds({ panel, canEnd, canRestore }: { panel: DemoPanelData; canEnd: boolean; canRestore: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const { total, active, onHome, ended } = panel;
  const phrase = `END ${active}`;

  async function undo(eventId: string) {
    const answer = await undoEndDemoAdsAction(eventId);
    toast.show({ kind: answer.ok ? "success" : "error", message: answer.message });
    router.refresh();
  }

  async function end() {
    setEnding(false);
    setBusy(true);
    const result = await endDemoAdsAction(phrase);
    setBusy(false);
    if (!result.ok) toast.show({ kind: "error", message: result.message });
    else toast.show({ kind: "undo", message: `Ended ${result.ended} demo ${result.ended === 1 ? "ad" : "ads"}.`, onUndo: () => void undo(result.eventId) });
    router.refresh();
  }

  async function restore() {
    setBusy(true);
    const result = await restoreDemoAdsAction();
    setBusy(false);
    toast.show({ kind: result.ok ? "success" : "error", message: result.message });
    router.refresh();
  }

  return (
    <section className="adm-ads-demo" aria-labelledby="demo-ads-heading" data-tk="demo-ads">
      <h2 id="demo-ads-heading">Demo ads</h2>
      <p>
        {total} demo {total === 1 ? "ad" : "ads"}, {active} still live. Demo ads fill the site before launch and are left out of every number on the Dashboard.
      </p>
      <dl className="adm-ads-demo-stats">
        <div>
          <dt>Demo ads live</dt>
          <dd>{active}</dd>
        </div>
        <div>
          <dt>On Home</dt>
          <dd>{onHome}</dd>
        </div>
        <div>
          <dt>Shown numbers</dt>
          <dd>Demo ads only</dd>
        </div>
      </dl>
      <p data-tk="end-demo-note">Ending them hides every demo ad at once. Real ads are never touched. A superadmin can bring them back for a few days.</p>
      <div className="adm-ads-demo-actions">
        {canEnd ? (
          <Button kind="danger" icon={Power} busy={busy} disabled={active === 0} data-tk="end-demo" onClick={() => setEnding(true)}>
            End demo ads...
          </Button>
        ) : null}
        {ended ? (
          <>
            <span data-tk="restore-note">
              {ended.count} demo {ended.count === 1 ? "ad was" : "ads were"} ended on {dayOf(ended.endedAt)}.{" "}
              {ended.canRestore ? `They can come back until ${dayOf(ended.restoreUntil)}.` : "The days to bring them back are over."}
            </span>
            {canRestore && ended.canRestore ? (
              <Button icon={History} busy={busy} data-tk="restore-demo" onClick={() => void restore()}>
                {`Restore ${ended.count} demo ${ended.count === 1 ? "ad" : "ads"}`}
              </Button>
            ) : null}
            {!canRestore ? <span className="adm-ads-demo-muted">Only a superadmin can restore them.</span> : null}
          </>
        ) : (
          <span className="adm-ads-demo-muted" data-tk="restore-note">Restore ended demo ads: nothing ended yet.</span>
        )}
      </div>
      <ReasonDialog
        key={ending ? "open" : "closed"}
        open={ending}
        title={`End ${active} demo ${active === 1 ? "ad" : "ads"}?`}
        body="They disappear from the site at once. Real ads are not touched. You can undo this now, and a superadmin can bring them back for 7 days."
        typedConfirm={phrase}
        confirmLabel={`End ${active} demo ${active === 1 ? "ad" : "ads"}`}
        danger
        onCancel={() => setEnding(false)}
        onConfirm={() => void end()}
      />
    </section>
  );
}
