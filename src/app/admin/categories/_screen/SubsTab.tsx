"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, ConfirmDialog, MoveButtons, TextField, useToast } from "@/components/admin/ui";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import type { CategoryDetailView } from "@/server/categories/screen";
import { createSubcategoryAction, deleteSubcategoryAction, reorderAction, updateSubcategoryAction } from "../manage-actions";
import { FormDialog } from "@/app/admin/_catalog/FormDialog";
import { MAX_INTRO, MAX_NAME, slugFromName } from "./model";

type Sub = CategoryDetailView["subs"][number];
type Draft = { name: string; slug: string; icon: string; seoIntro: string; enabled: boolean };
const BLANK: Draft = { name: "", slug: "", icon: "", seoIntro: "", enabled: true };

function reordered<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** The Sub-categories tab: the list in its order, and one small dialog to add or change a sub-category. */
export function SubsTab({ categoryId, categoryName, subs }: { categoryId: string; categoryName: string; subs: Sub[] }) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState(subs.map((row) => row.id));
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft; slugTouched: boolean } | null>(null);
  const [removing, setRemoving] = useState<Sub | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = order.map((id) => subs.find((row) => row.id === id)).filter((row): row is Sub => Boolean(row));
  const known = new Set(order);
  const list = [...shown, ...subs.filter((row) => !known.has(row.id))];

  async function move(from: number, to: number) {
    if (to < 0 || to >= list.length) return;
    const next = reordered(list, from, to).map((row) => row.id);
    setOrder(next);
    const result = await reorderAction("subcategory", next);
    toast.show(result.ok ? { kind: "success", message: "Order saved." } : { kind: "error", message: result.message });
    router.refresh();
  }

  function open(sub: Sub | null) {
    setError("");
    setEditing(sub ? { id: sub.id, draft: { name: sub.name, slug: sub.slug, icon: sub.icon, seoIntro: sub.seoIntro, enabled: sub.enabled }, slugTouched: true } : { id: null, draft: BLANK, slugTouched: false });
  }

  async function save() {
    if (!editing) return;
    const { draft, id } = editing;
    if (!draft.name.trim()) return setError("Write a name.");
    if (!draft.slug.trim()) return setError("Write a web address.");
    setBusy(true);
    const result = id ? await updateSubcategoryAction(id, draft) : await createSubcategoryAction({ ...draft, categoryId });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setEditing(null);
    toast.show({ kind: "success", message: id ? "Saved. An old web address leads to the new one." : `Added ${draft.name.trim()}.` });
    router.refresh();
  }

  async function remove() {
    const target = removing;
    setRemoving(null);
    if (!target) return;
    const result = await deleteSubcategoryAction(target.id);
    toast.show(result.ok ? { kind: "success", message: `Removed ${target.name}.` } : { kind: "error", message: result.message });
    router.refresh();
  }

  const patch = (change: Partial<Draft>, touched?: boolean) => setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...change }, slugTouched: touched ?? current.slugTouched } : current));

  return (
    <div className="adm-cat-subtab" data-tk="subs-tab">
      <div className="adm-cat-toolbar">
        <p>{list.length === 0 ? `${categoryName} has no sub-categories.` : "Use the arrows to change the order. It saves at once."}</p>
        <Button kind="primary" icon={Plus} onClick={() => open(null)}>Add sub-category</Button>
      </div>
      {list.length === 0 ? (
        <div className="adm-cat-sub-empty" data-tk="subs-empty">
          <p>Ads in this category do not ask for a sub-category until you add one.</p>
          <Button icon={Plus} onClick={() => open(null)}>Add the first sub-category</Button>
        </div>
      ) : (
        <ul className="adm-cat-subs" aria-label={`Sub-categories of ${categoryName}`}>
          {list.map((row, index) => (
            <li key={row.id} className="adm-cat-sub" data-tk="sub-row">
              <MoveButtons name={row.name} canUp={index > 0} canDown={index < list.length - 1} onUp={() => void move(index, index - 1)} onDown={() => void move(index, index + 1)} />
              <span className="adm-cat-name">
                <strong>{row.name}</strong>
                <small>/{row.slug}/</small>
              </span>
              {row.enabled ? null : <Badge>Hidden</Badge>}
              <Button icon={Pencil} onClick={() => open(row)}>{`Edit ${row.name}`}</Button>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={editing !== null}
        title={editing?.id ? "Edit sub-category" : "Add sub-category"}
        onClose={() => setEditing(null)}
        footer={
          <>
            {editing?.id ? (
              <Button kind="danger" onClick={() => { const row = subs.find((item) => item.id === editing.id) ?? null; setEditing(null); setRemoving(row); }}>Remove...</Button>
            ) : null}
            <span className="adm-k-sp" />
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button kind="primary" busy={busy} onClick={() => void save()}>{editing?.id ? "Save" : "Add"}</Button>
          </>
        }
      >
        {editing ? (
          <>
            <TextField label="Name" required max={MAX_NAME} value={editing.draft.name} onChange={(name) => patch({ name, ...(editing.slugTouched ? {} : { slug: slugFromName(name) }) })} />
            <TextField label="Web address" required value={editing.draft.slug} help="Lower case words joined by dashes." onChange={(slug) => patch({ slug }, true)} />
            <div className="adm-cat-field">
              <label className="adm-k-label" htmlFor="sub-icon">Icon</label>
              <select id="sub-icon" className="adm-k-input" value={editing.draft.icon} onChange={(event) => patch({ icon: event.target.value })}>
                <option value="">Default</option>
                {CATEGORY_ICONS.map((choice) => (
                  <option key={choice.key} value={choice.key}>{choice.label}</option>
                ))}
              </select>
            </div>
            <TextField label="SEO intro" multiline max={MAX_INTRO} value={editing.draft.seoIntro} onChange={(seoIntro) => patch({ seoIntro })} />
            <label className="adm-k-opt">
              <input type="checkbox" checked={editing.draft.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
              <span>Visible on the site</span>
            </label>
            {error ? <p className="adm-k-err" role="alert" data-tk="sub-error">{error}</p> : null}
          </>
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        body="A sub-category with ads cannot be removed. Hide it instead."
        confirmText={removing?.slug ?? ""}
        confirmLabel="Remove"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
