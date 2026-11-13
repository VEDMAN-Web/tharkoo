"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog, Notice, SortableList, Toggle } from "@/components/admin/ui";
import {
  createCategoryAction,
  createSubcategoryAction,
  deleteCategoryAction,
  deleteSubcategoryAction,
  reorderAction,
  updateCategoryAction,
  updateSubcategoryAction,
  type ManageResult,
} from "./manage-actions";

export type ManagedCategory = { id: string; slug: string; name: string; enabled: boolean; seoIntro: string };
export type ManagedSub = { id: string; categoryId: string; slug: string; name: string; icon: string; enabled: boolean; seoIntro: string };
type Draft = { name: string; slug: string; icon: string; seoIntro: string; enabled: boolean };
type Removing = { kind: "category" | "subcategory"; id: string; name: string; slug: string };

const EMPTY: Draft = { name: "", slug: "", icon: "", seoIntro: "", enabled: true };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" } as const;

function Field({ label, value, onChange, wide }: { label: string; value: string; onChange: (next: string) => void; wide?: boolean }) {
  return (
    <label className="adm-field" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <span className="adm-field-label">{label}</span>
      <input className="adm-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Editor({ draft, onChange, withIcon, actions }: { draft: Draft; onChange: (next: Draft) => void; withIcon: boolean; actions: React.ReactNode }) {
  return (
    <div style={grid}>
      <Field label="Name" value={draft.name} onChange={(name) => onChange({ ...draft, name })} />
      <Field label="Slug" value={draft.slug} onChange={(slug) => onChange({ ...draft, slug })} />
      {withIcon ? <Field label="Icon (name)" value={draft.icon} onChange={(icon) => onChange({ ...draft, icon })} /> : null}
      <Toggle checked={draft.enabled} onChange={(enabled) => onChange({ ...draft, enabled })} label={draft.enabled ? "Visible" : "Hidden"} />
      <Field label="SEO intro" value={draft.seoIntro} onChange={(seoIntro) => onChange({ ...draft, seoIntro })} wide />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>
    </div>
  );
}

function label(name: string, enabled: boolean) {
  return `${name}${enabled ? "" : " (hidden)"}`;
}

export function CategoriesManager({ categories, subs }: { categories: ManagedCategory[]; subs: ManagedSub[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(categories[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [fresh, setFresh] = useState<Draft>(EMPTY);
  const [freshSub, setFreshSub] = useState<Draft>(EMPTY);
  const [note, setNote] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);

  const category = categories.find((row) => row.id === selected) ?? categories[0];
  const mine = category ? subs.filter((row) => row.categoryId === category.id) : [];
  const draftOf = (id: string, base: Draft) => drafts[id] ?? base;
  const patch = (id: string, next: Draft) => setDrafts((current) => ({ ...current, [id]: next }));
  const categoryBase = category ? { name: category.name, slug: category.slug, icon: "", seoIntro: category.seoIntro, enabled: category.enabled } : EMPTY;

  async function done(result: ManageResult, ok: string, after?: () => void) {
    if (!result.ok) {
      setNote({ kind: "error", text: result.message });
      return;
    }
    setNote({ kind: "info", text: ok });
    after?.();
    router.refresh();
  }

  async function removeConfirmed() {
    const target = removing;
    setRemoving(null);
    if (!target) return;
    const result = target.kind === "category" ? await deleteCategoryAction(target.id) : await deleteSubcategoryAction(target.id);
    await done(result, "Removed.");
  }

  return (
    <div className="adm-stack">
      {note ? <Notice kind={note.kind}>{note.text}</Notice> : null}
      <section className="adm-card" aria-labelledby="cat-order-h">
        <h2 id="cat-order-h" className="adm-field-label" style={{ fontSize: 16 }}>Categories</h2>
        <p className="adm-field-help">Drag to reorder, or use the arrows. The order is saved straight away. Pick one to edit it and its sub-categories.</p>
        <SortableList
          label="Categories"
          items={categories.map((row) => ({ id: row.id, label: label(row.name, row.enabled) }))}
          onChange={async (next) => done(await reorderAction("category", next.map((item) => item.id)), "Order saved.")}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }} role="tablist" aria-label="Choose a category">
          {categories.map((row) => (
            <button
              key={row.id}
              type="button"
              role="tab"
              aria-selected={category?.id === row.id}
              className={`adm-btn ${category?.id === row.id ? "" : "adm-btn-ghost"}`}
              onClick={() => setSelected(row.id)}
            >
              {row.name}
            </button>
          ))}
        </div>
      </section>

      <section className="adm-card" aria-labelledby="cat-add-h">
        <h2 id="cat-add-h" className="adm-field-label" style={{ fontSize: 16 }}>Add a category</h2>
        <Editor
          draft={fresh}
          onChange={setFresh}
          withIcon={false}
          actions={
            <button type="button" className="adm-btn" disabled={!fresh.name.trim()} onClick={async () => done(await createCategoryAction(fresh), "Category added.", () => setFresh(EMPTY))}>
              Add category
            </button>
          }
        />
      </section>

      {category ? (
        <section className="adm-card" aria-labelledby="cat-edit-h" data-testid="category-edit">
          <h2 id="cat-edit-h" className="adm-field-label" style={{ fontSize: 16 }}>Edit {category.name}</h2>
          <Editor
            draft={draftOf(category.id, categoryBase)}
            onChange={(next) => patch(category.id, next)}
            withIcon={false}
            actions={
              <>
                <button type="button" className="adm-btn" onClick={async () => done(await updateCategoryAction(category.id, draftOf(category.id, categoryBase)), "Saved.")}>
                  Save
                </button>
                <button type="button" className="adm-btn adm-btn-danger" onClick={() => setRemoving({ kind: "category", id: category.id, name: category.name, slug: category.slug })}>
                  Remove
                </button>
              </>
            }
          />
          <p className="adm-field-help">A category that has ads cannot be removed. Switch it to Hidden instead.</p>
        </section>
      ) : null}

      {category ? (
        <section className="adm-card" aria-labelledby="sub-h" data-testid="subcategories">
          <h2 id="sub-h" className="adm-field-label" style={{ fontSize: 16 }}>Sub-categories of {category.name}</h2>
          {mine.length === 0 ? <p className="adm-field-help">None yet. Ads in this category do not ask for a sub-category until you add one.</p> : null}
          {mine.length > 1 ? (
            <SortableList
              label={`Sub-categories of ${category.name}`}
              items={mine.map((row) => ({ id: row.id, label: label(row.name, row.enabled) }))}
              onChange={async (next) => done(await reorderAction("subcategory", next.map((item) => item.id)), "Order saved.")}
            />
          ) : null}
          {mine.map((row) => {
            const base: Draft = { name: row.name, slug: row.slug, icon: row.icon, seoIntro: row.seoIntro, enabled: row.enabled };
            const draft = draftOf(row.id, base);
            return (
              <div key={row.id} style={{ marginTop: 14 }} data-testid="sub-row">
                <Editor
                  draft={draft}
                  onChange={(next) => patch(row.id, next)}
                  withIcon
                  actions={
                    <>
                      <button type="button" className="adm-btn" onClick={async () => done(await updateSubcategoryAction(row.id, draft), "Saved. An old slug redirects to the new one.")}>
                        Save
                      </button>
                      <button type="button" className="adm-btn adm-btn-danger" onClick={() => setRemoving({ kind: "subcategory", id: row.id, name: row.name, slug: row.slug })}>
                        Remove
                      </button>
                    </>
                  }
                />
              </div>
            );
          })}
          <h3 className="adm-field-label" style={{ marginTop: 18 }}>Add a sub-category</h3>
          <Editor
            draft={freshSub}
            onChange={setFreshSub}
            withIcon
            actions={
              <button
                type="button"
                className="adm-btn"
                disabled={!freshSub.name.trim()}
                onClick={async () => done(await createSubcategoryAction({ ...freshSub, categoryId: category.id }), "Sub-category added.", () => setFreshSub(EMPTY))}
              >
                Add sub-category
              </button>
            }
          />
        </section>
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        body="Anything with ads cannot be removed. Hide it instead."
        confirmText={removing?.slug ?? ""}
        onConfirm={removeConfirmed}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
