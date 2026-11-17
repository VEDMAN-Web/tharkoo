"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/Button";
import { Toggle } from "@/components/admin/ui/Toggle";

/**
 * "Draw the Home page from the Page builder" (H7.147). It is the switch `Site.homeFromLayout`.
 * Off: visitors see today's Home page. On: they see the published version. Turning it on asks first.
 */
export function HomeSwitch({ on, version, busy, onChange }: { on: boolean; version: number; busy: boolean; onChange: (next: boolean) => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <section className="adm-card adm-pb-switch" aria-labelledby="pb-switch" data-tk="home-switch" data-on={on ? "yes" : "no"}>
      <div className="adm-pb-switchrow">
        <Toggle
          checked={on}
          disabled={busy}
          label="Draw the Home page from the Page builder"
          onChange={(next) => {
            if (next) setAsking(true);
            else onChange(false);
          }}
        />
        <p className="adm-pb-note" id="pb-switch" data-tk="home-switch-state">
          {on ? `On: visitors see the published version${version > 0 ? ` ${version}` : ""}. The 8 Home ads slots always change Home at once.` : "Off: visitors see today's Home page, not your published versions. The 8 Home ads slots change Home at once either way."}
        </p>
      </div>
      {asking ? (
        <div className="adm-dialog-back" onClick={() => setAsking(false)}>
          <div className="adm-dialog" role="dialog" aria-modal="true" aria-label="Turn on the Home switch" data-tk="home-switch-dialog" onClick={(event) => event.stopPropagation()}>
            <h2>Draw the Home page from the Page builder?</h2>
            <p>Visitors will see the published version {version} now. You can turn it off again, or press Undo right after.</p>
            <div className="adm-dialog-actions">
              <Button kind="quiet" onClick={() => setAsking(false)}>Cancel</Button>
              <Button
                kind="primary"
                disabled={busy}
                onClick={() => {
                  setAsking(false);
                  onChange(true);
                }}
              >
                Turn on
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
