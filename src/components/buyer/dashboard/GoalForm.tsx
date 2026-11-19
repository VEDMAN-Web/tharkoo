"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveGoalAction } from "./actions";

export type GoalFormTexts = { change: string; label: string; save: string; cancel: string; error: string };

/** H14.3: "Change goal" opens a small inline form. The server checks the number again (50 to 1,000,000). */
export function GoalForm({ goal, texts }: { goal: number; texts: GoalFormTexts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(goal));
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="up-dash-link" data-tk="goal-change" onClick={() => setOpen(true)} style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", fontWeight: 700 }}>
        {texts.change}
      </button>
    );
  }
  return (
    <form
      className="up-dash-goal-form"
      data-tk="goal-form"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await saveGoalAction(value);
          setFailed(!result.ok);
          if (result.ok) {
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <label className="up-dash-goal-field">
        {texts.label}
        <input className="up-dash-goal-input" name="goal" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} aria-invalid={failed || undefined} />
      </label>
      <button type="submit" className="up-dash-pink" disabled={pending} style={{ minHeight: 44, fontSize: 15 }}>
        {texts.save}
      </button>
      <button type="button" className="up-dash-link" onClick={() => setOpen(false)} style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", fontWeight: 700 }}>
        {texts.cancel}
      </button>
      {failed ? (
        <p className="up-dash-goal-error" role="alert" data-tk="goal-error">
          {texts.error}
        </p>
      ) : null}
    </form>
  );
}
