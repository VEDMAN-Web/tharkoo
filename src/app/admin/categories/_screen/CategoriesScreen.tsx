"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, PageHeader, ToastProvider, useToast } from "@/components/admin/ui";
import type { EditorField } from "@/components/admin/category-fields/CategoryFieldsEditor";
import type { CategoriesScreenData, CategoryRowView } from "@/server/categories/screen";
import { reorderAction } from "../manage-actions";
import { CategoryList } from "./CategoryList";
import { DetailPane } from "./DetailPane";
import { NewCategoryDialog } from "./NewCategoryDialog";
import { tabOf, type TabKey } from "./model";
import "./categories.css";

const BASE = "/admin/categories/";

function urlFor(slug: string, tab: TabKey): string {
  return `${BASE}?c=${encodeURIComponent(slug)}${tab === "details" ? "" : `&tab=${tab}`}`;
}

function reordered<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Screen({ data, tab: startTab, fields }: { data: CategoriesScreenData; tab: TabKey; fields: EditorField[] }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>(startTab);
  const [local, setLocal] = useState<{ base: string; ids: string[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const dirty = useRef(false);
  const { detail } = data;

  useEffect(() => {
    const onPop = () => setTab(tabOf(new URLSearchParams(window.location.search).get("tab")));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);

  function changeTab(next: TabKey) {
    if (!detail) return;
    setTab(next);
    window.history.pushState(null, "", urlFor(detail.slug, next));
  }

  const baseKey = data.rows.map((row) => row.id).join(",");
  const order = local && local.base === baseKey ? local.ids : data.rows.map((row) => row.id);
  const byId = new Map(data.rows.map((row) => [row.id, row]));
  const rows = [...order.map((id) => byId.get(id)).filter((row): row is CategoryRowView => Boolean(row)), ...data.rows.filter((row) => !order.includes(row.id))];

  async function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = reordered(rows, from, to).map((row) => row.id);
    setLocal({ base: baseKey, ids: next });
    const result = await reorderAction("category", next);
    toast.show(result.ok ? { kind: "success", message: "Order saved." } : { kind: "error", message: result.message });
    if (!result.ok) setLocal(null);
    router.refresh();
  }

  function open(event: React.MouseEvent, row: CategoryRowView) {
    if (dirty.current && row.id !== detail?.id && !window.confirm("You have unsaved changes. Leave without saving?")) event.preventDefault();
  }

  return (
    <div className="adm-k" data-tk="categories-screen">
      <PageHeader
        crumbs={[{ label: "Catalogue" }]}
        title="Categories & fields"
        purpose="Order, pictures, sub-categories and the fields people fill in."
        primary={{ key: "new", label: "New category", icon: Plus, kind: "primary", onClick: () => setCreating(true) }}
      />
      <div className="adm-cat" data-view={data.chosen ? "detail" : "list"} data-tk="cat-layout">
        <section className="adm-card adm-cat-listcard" aria-labelledby="cat-list-title">
          <div className="adm-cat-listhead">
            <h2 id="cat-list-title">Categories</h2>
            <span>Drag or use the arrows</span>
          </div>
          <CategoryList rows={rows} selectedId={detail?.id ?? ""} hrefFor={(row) => urlFor(row.slug, tab)} onMove={(from, to) => void move(from, to)} onOpen={open} canEdit />
          <p className="adm-cat-listnote">The first four visible categories show on the Home page. The order saves at once.</p>
        </section>
        {detail ? (
          <DetailPane
            key={detail.id}
            detail={detail}
            fieldCount={data.rows.find((row) => row.id === detail.id)?.fieldCount ?? fields.length}
            fields={fields}
            tab={tab}
            onTab={changeTab}
            onDirty={onDirty}
            listHref={BASE}
            urlFor={urlFor}
          />
        ) : (
          <section className="adm-card adm-cat-detail">
            <div className="adm-cat-body">
              <p className="adm-cat-empty">No category yet.</p>
              <Button kind="primary" icon={Plus} onClick={() => setCreating(true)}>New category</Button>
            </div>
          </section>
        )}
      </div>
      <NewCategoryDialog open={creating} onClose={() => setCreating(false)} onCreated={(slug) => { setCreating(false); router.push(urlFor(slug, "details")); router.refresh(); }} />
    </div>
  );
}

/** Categories & fields: ONE master-detail screen. The list is on the left; the chosen category with its four tabs is on the right (a phone shows one at a time). */
export function CategoriesScreen(props: { data: CategoriesScreenData; tab: TabKey; fields: EditorField[] }) {
  return (
    <ToastProvider>
      <Screen {...props} />
    </ToastProvider>
  );
}
