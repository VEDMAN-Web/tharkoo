"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge, Button, Drawer, MoveButtons, Toggle } from "@/components/admin/ui";
import type { PlanRow } from "@/server/billing/plans-admin";
import { createPlanAction, movePlanAction, savePlanAction } from "../_actions/actions";
import { aboutRupees, checkPlanForm, creditsText } from "./prices-format";
import { useAnswer } from "./useAnswer";

type Form = { code: string; name: string; description: string; amount: string; days: string; shown: boolean };

const NEW_PLAN: Form = { code: "", name: "", description: "", amount: "", days: "7", shown: false };

/** The promotion plans table (move up and down, Edit) and the drawer that edits or adds one plan. */
export function PlansCard({ plans, freeCodes, creditPriceInr, canEdit }: { plans: PlanRow[]; freeCodes: string[]; creditPriceInr: number; canEdit: boolean }) {
  const answer = useAnswer();
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [busy, setBusy] = useState("");

  async function move(plan: PlanRow, direction: "up" | "down") {
    setBusy(plan.id);
    const result = await movePlanAction({ id: plan.id, direction });
    setBusy("");
    answer(result, `${plan.name} moved ${direction}.`);
  }

  return (
    <section className="adm-card adm-p-card adm-p-plans" data-tk="plans" aria-labelledby="plans-title">
      <header className="adm-p-head">
        <h2 id="plans-title">Promotion plans</h2>
        <span className="adm-k-help">Prices in credits</span>
        {canEdit ? (
          <Button icon={Plus} disabled={freeCodes.length === 0} onClick={() => setEditing("new")}>
            New plan
          </Button>
        ) : null}
      </header>
      <div className="adm-k-tablewrap adm-p-wrap">
        <table className="adm-k-table" data-tk="plans-table">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col" className="adm-k-hide-phone">Lasts</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              <th scope="col">{canEdit ? "Order and edit" : "Order"}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, index) => (
              <tr key={plan.id} data-tk="plan-row" data-code={plan.code}>
                <td className="adm-k-main">
                  <strong>{plan.name}</strong>
                  <small className="adm-p-sub">{plan.description || "No description"}</small>
                </td>
                <td className="adm-k-hide-phone">{plan.lasts}</td>
                <td>
                  <strong>{creditsText(plan.amount)}</strong>
                  <small className="adm-p-sub">{aboutRupees(plan.amount, creditPriceInr)}</small>
                </td>
                <td>{!plan.allowed ? <Badge tone="bad">Not allowed</Badge> : plan.shown ? <Badge tone="ok">Shown</Badge> : <Badge>Hidden</Badge>}</td>
                <td className="adm-k-rowact">
                  {canEdit ? (
                    <MoveButtons name={plan.name} canUp={index > 0 && busy !== plan.id} canDown={index < plans.length - 1 && busy !== plan.id} onUp={() => void move(plan, "up")} onDown={() => void move(plan, "down")} />
                  ) : null}
                  {canEdit ? (
                    <Button size="sm" icon={Pencil} disabled={!plan.allowed} onClick={() => setEditing(plan)}>
                      Edit
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {plans.length === 0 ? (
              <tr>
                <td colSpan={5}>No promotion plans yet. Use New plan to add one.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {editing ? <PlanDrawer key={editing === "new" ? "new" : editing.id} plan={editing === "new" ? null : editing} freeCodes={freeCodes} creditPriceInr={creditPriceInr} onClose={() => setEditing(null)} onSaved={answer} /> : null}
    </section>
  );
}

function PlanDrawer({ plan, freeCodes, creditPriceInr, onClose, onSaved }: { plan: PlanRow | null; freeCodes: string[]; creditPriceInr: number; onClose: () => void; onSaved: (result: Awaited<ReturnType<typeof savePlanAction>>, message: string) => boolean }) {
  const [form, setForm] = useState<Form>(
    plan ? { code: plan.code, name: plan.name, description: plan.description, amount: String(plan.amount), days: String(plan.durationDays), shown: plan.shown } : { ...NEW_PLAN, code: freeCodes[0] ?? "" },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** Any edit clears an old error, so the message never stays after the field was fixed. */
  const change = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError("");
  };
  const fixedLength = plan ? plan.fixedLength : form.code === "flash" || form.code === "auto-boost";
  const amount = Number(form.amount.trim());
  const hint = form.amount.trim() !== "" && Number.isInteger(amount) && amount >= 0 ? aboutRupees(amount, creditPriceInr) : "";

  async function save() {
    const problem = checkPlanForm({ name: form.name, description: form.description, amount: form.amount, days: form.days, fixedLength, code: form.code });
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    const body = { name: form.name, description: form.description, amount: Number(form.amount.trim()), durationDays: Number(form.days.trim() || "1"), shown: form.shown };
    const result = plan ? await savePlanAction({ id: plan.id, ...body }) : await createPlanAction({ code: form.code, ...body });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onSaved(result, plan ? `${form.name} saved.` : `${form.name} added. It stays hidden until you turn it on.`);
    onClose();
  }

  return (
    <Drawer
      open
      title={plan ? `Edit ${plan.name}` : "New plan"}
      subtitle={plan ? `Plan type: ${plan.code}` : "Choose a plan type that does not exist yet"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void save()}>
            {plan ? "Save plan" : "Add plan"}
          </Button>
        </>
      }
    >
      <div className="adm-p-form" data-tk="plan-form">
        {!plan ? (
          <div className="adm-k-field">
            <label className="adm-k-label" htmlFor="plan-code">Plan type</label>
            <select id="plan-code" className="adm-k-input" value={form.code} onChange={(event) => change({ code: event.target.value })}>
              {freeCodes.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="plan-name">Name<span className="adm-k-req" aria-hidden="true"> *</span></label>
          <input id="plan-name" className="adm-k-input" value={form.name} maxLength={40} autoComplete="off" onChange={(event) => change({ name: event.target.value })} />
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="plan-desc">Line under the name<span className="adm-k-req" aria-hidden="true"> *</span></label>
          <input id="plan-desc" className="adm-k-input" value={form.description} maxLength={120} autoComplete="off" onChange={(event) => change({ description: event.target.value })} />
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="plan-amount">Price (credits)<span className="adm-k-req" aria-hidden="true"> *</span></label>
          <input id="plan-amount" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.amount} onChange={(event) => change({ amount: event.target.value })} />
          <p className="adm-k-help">{hint || "A whole number of credits."}</p>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="plan-days">Days</label>
          {fixedLength ? (
            <p className="adm-k-help" id="plan-days">The length of this plan type is fixed, so there is nothing to set.</p>
          ) : (
            <>
              <input id="plan-days" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.days} onChange={(event) => change({ days: event.target.value })} />
              <p className="adm-k-help">{form.code === "top" ? "TOP lasts 1, 3 or 7 days." : "A whole number of days."}</p>
            </>
          )}
        </div>
        <Toggle checked={form.shown} label={form.shown ? "Shown to advertisers" : "Hidden from advertisers"} onChange={(next) => change({ shown: next })} />
        {error ? <p className="adm-k-err" role="alert" data-tk="plan-error">{error}</p> : null}
      </div>
    </Drawer>
  );
}
