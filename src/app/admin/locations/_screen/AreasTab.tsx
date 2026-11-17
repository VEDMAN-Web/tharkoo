"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { undoAction } from "@/app/admin/undo-actions";
import { FormDialog } from "@/app/admin/_catalog/FormDialog";
import { MAX_NAME, adsText } from "@/app/admin/_catalog/model";
import { Badge, Button, ConfirmDialog, TextField, useToast } from "@/components/admin/ui";
import type { PlaceAreaView } from "@/server/locations/screen";
import { createAreaAction, removeAreaAction, updateAreaAction } from "../area-actions";

type Target = { id: string; name: string; slug: string; enabled: boolean; kind: "district" | "locality"; ads: number };
type Editing = { mode: "add"; parentId: string; parentName: string; kind: "district" | "locality" } | { mode: "edit"; target: Target };

/**
 * The Areas tab of a city: its districts, and the localities inside each district. Add, rename, hide and remove, each as one small dialog.
 * A rename or a hide can be undone from the toast. An area with ads cannot be removed: hide it instead.
 */
export function AreasTab({ cityId, cityName, areas }: { cityId: string; cityName: string; areas: PlaceAreaView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(true);
  const [removing, setRemoving] = useState<Target | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function open(next: Editing) {
    setError("");
    setEditing(next);
    setName(next.mode === "edit" ? next.target.name : "");
    setVisible(next.mode === "edit" ? next.target.enabled : true);
  }

  async function undo(eventId: string) {
    const outcome = await undoAction(eventId);
    toast.show(outcome.ok ? { kind: "success", message: "Undone." } : { kind: "error", message: outcome.message });
    router.refresh();
  }

  async function save() {
    if (!editing) return;
    if (!name.trim()) return setError("Write a name.");
    setBusy(true);
    if (editing.mode === "add") {
      const result = await createAreaAction({ parentId: editing.parentId, name });
      setBusy(false);
      if (!result.ok) return setError(result.message);
      toast.show({ kind: "success", message: `Added ${name.trim()}.` });
    } else {
      const change: { name?: string; enabled?: boolean } = {};
      if (name.trim() !== editing.target.name) change.name = name;
      if (visible !== editing.target.enabled) change.enabled = visible;
      if (Object.keys(change).length === 0) {
        setBusy(false);
        setEditing(null);
        return;
      }
      const result = await updateAreaAction(editing.target.id, change);
      setBusy(false);
      if (!result.ok) return setError(result.message);
      const eventId = (result as { eventId?: string }).eventId ?? "";
      const words = change.enabled === undefined ? `Renamed to ${name.trim()}.` : change.enabled ? `${editing.target.name} is visible again.` : `${editing.target.name} is hidden.`;
      toast.show(eventId ? { kind: "undo", message: words, onUndo: () => void undo(eventId) } : { kind: "success", message: words });
    }
    setEditing(null);
    router.refresh();
  }

  async function remove() {
    const target = removing;
    setRemoving(null);
    if (!target) return;
    const result = await removeAreaAction(target.id);
    toast.show(result.ok ? { kind: "success", message: `Removed ${target.name}.` } : { kind: "error", message: result.message });
    router.refresh();
  }

  const row = (target: Target) => (
    <div className="adm-cat-sub" data-tk={target.kind === "district" ? "district-row" : "locality-row"} data-slug={target.slug}>
      <span className="adm-cat-name">
        <strong>{target.name}</strong>
        <small>{`/${target.slug}/${target.kind === "district" ? ` · ${adsText(target.ads)}` : ""}`}</small>
      </span>
      {target.enabled ? null : <Badge>Hidden</Badge>}
      <Button icon={Pencil} onClick={() => open({ mode: "edit", target })}>{`Edit ${target.name}`}</Button>
    </div>
  );

  return (
    <div className="adm-cat-subtab" data-tk="areas-tab">
      <div className="adm-cat-toolbar">
        <p>{areas.length === 0 ? `${cityName} has no districts yet.` : "Districts of this city, with the localities inside each one."}</p>
        <Button kind="primary" icon={Plus} onClick={() => open({ mode: "add", parentId: cityId, parentName: cityName, kind: "district" })}>Add district</Button>
      </div>
      {areas.length === 0 ? (
        <div className="adm-cat-sub-empty" data-tk="areas-empty">
          <p>Districts help people narrow an ad to part of the city. Add the first one.</p>
        </div>
      ) : (
        <ul className="adm-cat-subs" aria-label={`Districts of ${cityName}`}>
          {areas.map((district) => (
            <li key={district.id} data-tk="district">
              {row({ id: district.id, name: district.name, slug: district.slug, enabled: district.enabled, kind: "district", ads: district.ads })}
              <ul className="adm-cat-subs" aria-label={`Localities of ${district.name}`} style={{ margin: "0 12px 8px 28px" }}>
                {district.localities.map((locality) => (
                  <li key={locality.id}>{row({ id: locality.id, name: locality.name, slug: locality.slug, enabled: locality.enabled, kind: "locality", ads: 0 })}</li>
                ))}
                <li style={{ padding: "6px 12px" }}>
                  <Button size="sm" icon={Plus} onClick={() => open({ mode: "add", parentId: district.id, parentName: district.name, kind: "locality" })}>{`Add locality to ${district.name}`}</Button>
                </li>
              </ul>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={editing !== null}
        title={editing?.mode === "add" ? `Add ${editing.kind}` : `Edit ${editing?.target.kind ?? "area"}`}
        intro={editing?.mode === "add" ? `It goes inside ${editing.parentName}. Its web address comes from the name.` : undefined}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing?.mode === "edit" ? (
              <Button kind="danger" onClick={() => { const target = editing.target; setEditing(null); setRemoving(target); }}>Remove...</Button>
            ) : null}
            <span className="adm-k-sp" />
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button kind="primary" busy={busy} onClick={() => void save()}>{editing?.mode === "add" ? "Add" : "Save"}</Button>
          </>
        }
      >
        <TextField label="Name" required max={MAX_NAME} value={name} onChange={(next) => { setName(next); setError(""); }} />
        {editing?.mode === "edit" ? (
          <label className="adm-k-opt">
            <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
            <span>Visible on the site</span>
          </label>
        ) : null}
        {error ? <p className="adm-k-err" role="alert" data-tk="area-error">{error}</p> : null}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        body="An area with ads or with places inside it cannot be removed. Hide it instead."
        confirmText={removing?.slug ?? ""}
        confirmLabel="Remove"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
