"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Drawer, Toggle, useToast } from "@/components/admin/ui";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { VIDEO_NEVER_FOR_PEOPLE, type KindView } from "@/lib/category-kinds";
import { createKindAction, removeKindAction, undoKindAction, updateKindAction, type KindAnswer } from "../kind-actions";

type Draft = { name: string; icon: string; maxPhotos: string; showPrice: boolean; showMap: boolean; showContact: boolean; videoTours: boolean };

const blank: Draft = { name: "", icon: "", maxPhotos: "", showPrice: true, showMap: true, showContact: true, videoTours: false };
const draftOf = (kind: KindView): Draft => ({ name: kind.name, icon: kind.icon, maxPhotos: kind.maxPhotos === null ? "" : String(kind.maxPhotos), showPrice: kind.showPrice, showMap: kind.showMap, showContact: kind.showContact, videoTours: kind.videoTours });
const input = (draft: Draft) => ({ ...draft, maxPhotos: draft.maxPhotos.trim() === "" ? null : Number(draft.maxPhotos) });

function Form({ draft, locked, onChange }: { draft: Draft; locked: boolean; onChange: (next: Draft) => void }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <div className="adm-kd-form">
      <label className="adm-k-label">
        Name
        <input className="adm-k-input" value={draft.name} maxLength={40} onChange={(event) => set({ name: event.target.value })} />
      </label>
      <label className="adm-k-label">
        Default icon
        <select className="adm-k-input" value={draft.icon} onChange={(event) => set({ icon: event.target.value })}>
          <option value="">A plain tag</option>
          {CATEGORY_ICONS.map((choice) => (
            <option key={choice.key} value={choice.key}>{choice.label}</option>
          ))}
        </select>
      </label>
      <label className="adm-k-label">
        Max photos per ad (1 to 30, blank is 10)
        <input className="adm-k-input" type="number" min={1} max={30} placeholder="10" value={draft.maxPhotos} onChange={(event) => set({ maxPhotos: event.target.value })} />
      </label>
      <Toggle label="Show the price on the ad page" checked={draft.showPrice} onChange={(showPrice) => set({ showPrice })} />
      <Toggle label="Show the contact buttons" checked={draft.showContact} onChange={(showContact) => set({ showContact })} />
      <Toggle label="Live video tours allowed" checked={locked ? false : draft.videoTours} disabled={locked} onChange={(videoTours) => set({ videoTours })} />
      {locked ? <p className="adm-k-help" data-tk="video-never">{VIDEO_NEVER_FOR_PEOPLE}</p> : null}
    </div>
  );
}

/** The Kinds manager (H7.167): add, rename and remove kinds, and set what each kind turns on. */
export function KindsDrawer({ kinds, open, onClose }: { kinds: KindView[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function answer(result: KindAnswer) {
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setError("");
    setEditing(null);
    toast.show({ kind: "undo", message: result.message, onUndo: () => void undoKindAction(result.eventId).then((back) => { toast.show({ kind: back.ok ? "success" : "error", message: back.message }); router.refresh(); }) });
    router.refresh();
  }

  async function save() {
    setBusy(true);
    answer(editing === "" ? await createKindAction(input(draft)) : await updateKindAction(editing ?? "", input(draft)));
  }

  async function remove(key: string) {
    setBusy(true);
    answer(await removeKindAction(key));
  }

  return (
    <Drawer
      open={open}
      title="Kinds"
      subtitle="A kind decides what a category turns on. Each category picks one."
      onClose={onClose}
      footer={<Button kind="primary" onClick={() => { setDraft(blank); setError(""); setEditing(""); }}>Add a kind</Button>}
    >
      <div data-tk="kinds-manager" className="adm-kd">
        {error ? <p className="adm-k-err" role="alert" data-tk="kind-error">{error}</p> : null}
        {editing === "" ? (
          <section className="adm-kd-row" aria-label="New kind">
            <Form draft={draft} locked={false} onChange={setDraft} />
            <div className="adm-kd-actions">
              <Button kind="quiet" onClick={() => setEditing(null)}>Cancel</Button>
              <Button kind="primary" busy={busy} onClick={() => void save()}>Add kind</Button>
            </div>
          </section>
        ) : null}
        <ul className="adm-kd-list">
          {kinds.map((kind) => (
            <li key={kind.key} className="adm-kd-row" data-tk="kind-row" data-key={kind.key}>
              <div className="adm-kd-head">
                <strong>{kind.name}</strong>
                <span className="adm-k-help">{kind.used === 0 ? "No category uses it" : `${kind.used} categor${kind.used === 1 ? "y" : "ies"}`}</span>
                <Button size="sm" onClick={() => { setDraft(draftOf(kind)); setError(""); setEditing(kind.key); }}>Edit</Button>
              </div>
              {editing === kind.key ? (
                <>
                  <Form draft={draft} locked={kind.key === "people"} onChange={setDraft} />
                  <div className="adm-kd-actions">
                    {kind.key === "people" ? <span className="adm-k-help">Built in, so it cannot be removed.</span> : <Button kind="danger" disabled={kind.used > 0 || busy} onClick={() => void remove(kind.key)}>{kind.used > 0 ? "In use: cannot remove" : "Remove"}</Button>}
                    <Button kind="quiet" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button kind="primary" busy={busy} onClick={() => void save()}>Save kind</Button>
                  </div>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  );
}
