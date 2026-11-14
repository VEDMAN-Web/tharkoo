"use client";

import { useState, useTransition } from "react";
import { SeoTitleSection } from "@/components/admin/SeoTitleSection";
import { EmptyState, Notice } from "@/components/admin/ui";
import { PAGE_GROUPS, type PageTitleRow } from "@/lib/seo/page-title-defaults";
import { resetPageTitleAction, savePageTitleAction } from "./actions";

const BUILT_IN = "Built into the page";

/** Searchable list of every page type. One row can be open at a time; Edit opens the inline editor. */
export function PageTitlesTable({ rows: initial }: { rows: PageTitleRow[] }) {
  const [rows, setRows] = useState(initial);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) => [row.groupLabel, row.label, row.address, row.title, row.description].join(" ").toLowerCase().includes(needle))
    : rows;

  function patchRow(id: string, patch: Partial<PageTitleRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  return (
    <div className="adm-stack">
      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0 }}>
          Every page type on Tharkoo, with the title and description it shows in Google. Choose Edit to change one. Words in braces, such as
          {" {city}"}, are filled in for each page. A page address that has its own title in Page overrides shows that title instead.
        </p>
        <div className="adm-field">
          <label className="adm-field-label" htmlFor="page-title-search">
            Search pages
          </label>
          <input
            id="page-title-search"
            type="search"
            className="adm-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="A city, a category or an address"
          />
          <span className="adm-field-help" aria-live="polite">
            Showing {visible.length} of {rows.length} pages.
          </span>
        </div>
      </section>
      {message ? <Notice kind="info">{message}</Notice> : null}
      {visible.length === 0 ? <EmptyState title="No page matches that search" why="Try a shorter word or a different city or category." /> : null}
      {PAGE_GROUPS.map((group) => {
        const items = visible.filter((row) => row.group === group.id);
        if (items.length === 0) return null;
        return (
          <section key={group.id} className="adm-stack" aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} style={{ margin: "8px 0 0", fontSize: 18 }}>
              {group.label}
            </h2>
            {items.map((row) => (
              <PageTitleCard
                key={row.id}
                row={row}
                open={openId === row.id}
                onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                onSaved={(values) => patchRow(row.id, { title: values.title, description: values.description, saved: true })}
                onReset={(values) => {
                  patchRow(row.id, { title: values.title, description: values.description, saved: values.saved });
                  setOpenId(null);
                  setMessage(`Reset ${row.label}. It now uses its template or the built-in copy.`);
                }}
                onError={(text) => setMessage(text)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function PageTitleCard({
  row,
  open,
  onToggle,
  onSaved,
  onReset,
  onError,
}: {
  row: PageTitleRow;
  open: boolean;
  onToggle: () => void;
  onSaved: (values: { title: string; description: string }) => void;
  onReset: (values: { title: string; description: string; saved: boolean }) => void;
  onError: (text: string) => void;
}) {
  const [pending, start] = useTransition();
  const target = row.target;

  function reset() {
    if (!target) return;
    start(async () => {
      const out = await resetPageTitleAction(target);
      if (out.ok) onReset({ title: out.seoTitle, description: out.seoDescription, saved: out.saved });
      else onError(out.message);
    });
  }

  return (
    <article className="adm-card" style={{ display: "grid", gap: 10 }} aria-labelledby={`${row.id}-label`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <h3 id={`${row.id}-label`} style={{ margin: 0, fontSize: 16, overflowWrap: "anywhere" }}>
            {row.label}
          </h3>
          <p className="adm-field-help" style={{ margin: 0, overflowWrap: "anywhere" }}>
            {row.address}
          </p>
        </div>
        <span className="adm-field-help" style={{ whiteSpace: "nowrap" }}>
          {row.saved ? "Saved text" : "Built-in or inherited"}
        </span>
      </div>
      <dl style={{ display: "grid", gap: 8, margin: 0 }}>
        <div style={{ display: "grid", gap: 2 }}>
          <dt className="adm-field-label">Title</dt>
          <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{row.title || BUILT_IN}</dd>
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          <dt className="adm-field-label">Description</dt>
          <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{row.description || BUILT_IN}</dd>
        </div>
      </dl>
      {row.note ? (
        <p className="adm-field-help" style={{ margin: 0 }}>
          {row.note}
        </p>
      ) : null}
      {target ? (
        <div>
          <button type="button" className="adm-btn adm-btn-quiet" aria-expanded={open} aria-label={`Edit ${row.label}`} onClick={onToggle}>
            {open ? "Close" : "Edit"}
          </button>
        </div>
      ) : (
        <p className="adm-field-help" style={{ margin: 0 }}>
          This page cannot be edited here.
        </p>
      )}
      {open && target ? (
        <SeoTitleSection
          compact
          headingId={`${row.id}-seo`}
          heading="Edit title and description"
          help="Saving replaces the saved text for this row only. Leave the other words of the page as they are."
          initial={{ seoTitle: row.title, seoDescription: row.description }}
          siteLabel={row.siteLabel}
          previewVars={row.previewVars}
          save={async (input) => {
            const out = await savePageTitleAction(target, input);
            if (out.ok) onSaved({ title: out.seoTitle, description: out.seoDescription });
            return out;
          }}
          footer={
            <button type="button" className="adm-btn adm-btn-quiet" onClick={reset} disabled={pending}>
              {pending ? "Resetting..." : "Reset to template"}
            </button>
          }
        />
      ) : null}
    </article>
  );
}
