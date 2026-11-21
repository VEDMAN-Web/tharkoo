"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Badge, Button, Drawer, Toggle } from "@/components/admin/ui";
import type { PackRow } from "@/server/billing/packs-admin";
import { PACK_TAGS } from "@/server/billing/pack-tags";
import { useAnswer } from "../_view/useAnswer";
import { savePackAction, createPackAction } from "./actions";
import { checkPackForm, packText, perCreditText } from "./pack-format";

type Form = { credits: string; bonus: string; price: string; tag: string; shown: boolean; wallet: "ad" | "call" };

const NEW_PACK: Form = { credits: "", bonus: "0", price: "", tag: "", shown: false, wallet: "ad" };

/** The recharge packs table (smallest first, as people see it) and the drawer that edits or adds one pack. */
export function PacksCard({ packs, canEdit }: { packs: PackRow[]; canEdit: boolean }) {
  const answer = useAnswer();
  const [editing, setEditing] = useState<PackRow | "new" | null>(null);

  return (
    <section className="adm-card adm-p-card adm-p-plans" data-tk="packs" aria-labelledby="packs-title">
      <header className="adm-p-head">
        <h2 id="packs-title">Recharge packs</h2>
        {canEdit ? (
          <Button icon={Plus} onClick={() => setEditing("new")}>
            New pack
          </Button>
        ) : null}
      </header>
      <div className="adm-k-tablewrap adm-p-wrap">
        <table className="adm-k-table" data-tk="packs-table">
          <thead>
            <tr>
              <th scope="col">Pack</th>
              <th scope="col">Price</th>
              <th scope="col">Per credit</th>
              <th scope="col">Tag</th>
              <th scope="col">Status</th>
              <th scope="col">{canEdit ? "Edit" : ""}</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((pack) => (
              <tr key={pack.id} data-tk="pack-row" data-total={pack.total}>
                <td className="adm-k-main"><strong>{packText(pack.credits, pack.bonus)}</strong> <Badge tone={pack.wallet === "call" ? "ok" : "neutral"}>{pack.wallet === "call" ? "Call" : "Ad"}</Badge></td>
                <td>{`₹${pack.price.toLocaleString("en-IN")}`}</td>
                <td>{perCreditText(pack.perCredit)}</td>
                <td>{pack.tag ? <Badge tone="neutral">{pack.tag}</Badge> : "None"}</td>
                <td>{pack.shown ? <Badge tone="ok">Shown</Badge> : <Badge>Hidden</Badge>}</td>
                <td className="adm-k-rowact">
                  {canEdit ? (
                    <Button size="sm" icon={Pencil} onClick={() => setEditing(pack)}>
                      Edit
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {packs.length === 0 ? (
              <tr>
                <td colSpan={6}>No recharge packs yet. Use New pack to add one.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="adm-p-foot adm-k-help">Packs show smallest first. A hidden pack is not offered to anyone.</p>
      {editing ? <PackDrawer key={editing === "new" ? "new" : editing.id} pack={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={answer} /> : null}
    </section>
  );
}

function PackDrawer({ pack, onClose, onSaved }: { pack: PackRow | null; onClose: () => void; onSaved: (result: Awaited<ReturnType<typeof savePackAction>>, message: string) => boolean }) {
  const [form, setForm] = useState<Form>(pack ? { credits: String(pack.credits), bonus: String(pack.bonus), price: String(pack.price), tag: pack.tag, shown: pack.shown, wallet: pack.wallet } : NEW_PACK);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError("");
  };
  const credits = Number(form.credits.trim());
  const bonus = Number(form.bonus.trim() || "0");
  const price = Number(form.price.trim());
  const ok = form.credits.trim() !== "" && form.price.trim() !== "" && Number.isInteger(credits) && Number.isInteger(bonus) && Number.isInteger(price) && credits > 0 && price > 0;
  const hint = ok ? `${perCreditText(price / (credits + bonus))} for each credit` : "";

  async function save() {
    const problem = checkPackForm({ credits: form.credits, bonus: form.bonus, price: form.price });
    if (problem) return setError(problem);
    setBusy(true);
    const body = { credits, bonus, price, tag: form.tag, shown: form.shown, wallet: form.wallet };
    const result = pack ? await savePackAction({ id: pack.id, ...body }) : await createPackAction(body);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onSaved(result, pack ? "Pack saved." : "Pack added. It stays hidden until you turn it on.");
    onClose();
  }

  return (
    <Drawer
      open
      title={pack ? `Edit ${packText(pack.credits, pack.bonus)}` : "New pack"}
      subtitle="Recharge pack"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <span className="adm-k-sp" />
          <Button kind="primary" busy={busy} onClick={() => void save()}>
            {pack ? "Save pack" : "Add pack"}
          </Button>
        </>
      }
    >
      <div className="adm-p-form" data-tk="pack-form">
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="pack-credits">Credits<span className="adm-k-req" aria-hidden="true"> *</span></label>
          <input id="pack-credits" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.credits} onChange={(event) => change({ credits: event.target.value })} />
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="pack-bonus">Free credits on top</label>
          <input id="pack-bonus" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.bonus} onChange={(event) => change({ bonus: event.target.value })} />
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="pack-price">Price (₹)<span className="adm-k-req" aria-hidden="true"> *</span></label>
          <input id="pack-price" className="adm-k-input" inputMode="numeric" autoComplete="off" value={form.price} onChange={(event) => change({ price: event.target.value })} />
          <p className="adm-k-help">{hint || "A whole number of rupees."}</p>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="pack-wallet">Credit type</label>
          <select id="pack-wallet" className="adm-k-input" value={form.wallet} onChange={(event) => change({ wallet: event.target.value === "call" ? "call" : "ad" })}>
            <option value="ad">Ad credits (posting, TOP, Super Top)</option>
            <option value="call">Call credits (video calls only)</option>
          </select>
        </div>
        <div className="adm-k-field">
          <label className="adm-k-label" htmlFor="pack-tag">Tag</label>
          <select id="pack-tag" className="adm-k-input" value={form.tag} onChange={(event) => change({ tag: event.target.value })}>
            {PACK_TAGS.map((tag) => (
              <option key={tag} value={tag}>{tag || "None"}</option>
            ))}
          </select>
        </div>
        <Toggle checked={form.shown} label={form.shown ? "Shown to advertisers" : "Hidden from advertisers"} onChange={(next) => change({ shown: next })} />
        {error ? <p className="adm-k-err" role="alert" data-tk="pack-error">{error}</p> : null}
      </div>
    </Drawer>
  );
}
