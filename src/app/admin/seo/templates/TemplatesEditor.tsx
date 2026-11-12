"use client";

import { useMemo, useState, useTransition } from "react";
import { Notice, SaveBar, SerpPreview, TextField } from "@/components/admin/ui";
import {
  TEMPLATE_FIELDS,
  TEMPLATE_LIMITS,
  TEMPLATE_PAGE_TYPES,
  TEMPLATE_VARIABLES,
  DESCRIPTION_RANGE,
  TITLE_RANGE,
  renderTemplate,
  templateKey,
  templateWarnings,
  type TemplateField,
  type TemplateFields,
  type TemplatePageType,
} from "@/lib/seo/landing";
import { textDenied } from "@/server/shared/policy";
import { deleteTemplateAction, saveTemplateAction } from "./actions";

export interface EditorTemplate {
  key: string;
  fields: TemplateFields;
}

const EMPTY: TemplateFields = { title: "", description: "", h1: "", intro: "" };
const LABELS: Record<TemplateField, string> = { title: "Title", description: "Description", h1: "H1 (main heading)", intro: "Intro text" };

export function TemplatesEditor({
  initial,
  defaults,
  categories,
  cities,
  siteName,
}: {
  initial: EditorTemplate[];
  defaults: Record<string, TemplateFields>;
  categories: { slug: string; name: string }[];
  cities: string[];
  siteName: string;
}) {
  const [stored, setStored] = useState(initial);
  const [pageType, setPageType] = useState<TemplatePageType>("location");
  const [categorySlug, setCategorySlug] = useState("");
  const [sampleCity, setSampleCity] = useState(cities[0] ?? "Pune");
  const key = templateKey(pageType, categorySlug || null);
  const savedFields = stored.find((item) => item.key === key)?.fields ?? null;
  const [fields, setFields] = useState<TemplateFields>(savedFields ?? EMPTY);
  const [focus, setFocus] = useState<TemplateField>("title");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();

  const dirty = JSON.stringify(fields) !== JSON.stringify(savedFields ?? EMPTY);
  const category = categories.find((item) => item.slug === categorySlug) ?? categories[0];
  const categoryName = category?.name ?? "Category";
  const placeholders = defaults[pageType] ?? EMPTY;

  function choose(nextType: TemplatePageType, nextCategory: string) {
    if (dirty && !window.confirm("You have unsaved changes. Switch anyway?")) return;
    const nextKey = templateKey(nextType, nextCategory || null);
    setPageType(nextType);
    setCategorySlug(nextCategory);
    setFields(stored.find((item) => item.key === nextKey)?.fields ?? EMPTY);
    setErrors({});
    setMessage("");
  }

  const sample = useMemo(
    () => ({ category: categoryName, city: sampleCity, district: "Central", state: "India", count: 12, site: siteName }),
    [categoryName, sampleCity, siteName],
  );
  const shown = (field: TemplateField) => renderTemplate(fields[field] || placeholders[field], sample);
  const warnings = useMemo(
    () => templateWarnings(fields, { category: categoryName, site: siteName, samples: cities.slice(0, 20), denied: (text) => textDenied(text).denied }),
    [fields, categoryName, siteName, cities],
  );

  function insert(name: string) {
    setFields((current) => ({ ...current, [focus]: `${current[focus]}${current[focus] && !current[focus].endsWith(" ") ? " " : ""}{${name}}` }));
  }

  function save() {
    start(async () => {
      const out = await saveTemplateAction({ pageType, categorySlug: categorySlug || null, fields });
      if (out.ok) {
        setStored((rows) => [...rows.filter((item) => item.key !== out.key), { key: out.key, fields }]);
        setErrors({});
        setMessage("Saved. Pages pick it up within a minute.");
      } else {
        setErrors(out.fields);
        setMessage(out.message);
      }
    });
  }

  function remove() {
    if (!categorySlug || !window.confirm("Delete this category template? The page-type default will be used instead.")) return;
    start(async () => {
      const out = await deleteTemplateAction(key);
      if (out.ok) {
        setStored((rows) => rows.filter((item) => item.key !== key));
        setFields(EMPTY);
        setMessage("Deleted.");
      } else {
        setMessage(out.message);
      }
    });
  }

  return (
    <div className="adm-stack">
      <section className="adm-card" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <label className="adm-field">
          <span className="adm-field-label">Page type</span>
          <select className="adm-input" value={pageType} onChange={(event) => choose(event.target.value as TemplatePageType, categorySlug)}>
            {TEMPLATE_PAGE_TYPES.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Category</span>
          <select className="adm-input" value={categorySlug} onChange={(event) => choose(pageType, event.target.value)}>
            <option value="">All categories (default)</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name} only
              </option>
            ))}
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field-label">Sample city for the preview</span>
          <select className="adm-input" value={sampleCity} onChange={(event) => setSampleCity(event.target.value)}>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </section>

      <Notice kind="info">
        A category template wins over the page-type default, field by field. A page override (Page overrides screen) wins over both. Empty fields use the built-in text shown in grey.
      </Notice>

      <section className="adm-card" style={{ display: "grid", gap: 8 }}>
        <p className="adm-field-label" style={{ margin: 0 }}>
          Click a variable to add it to the field you last used
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TEMPLATE_VARIABLES.map((name) => (
            <button key={name} type="button" className="adm-btn adm-btn-quiet" style={{ minHeight: 36 }} onClick={() => insert(name)}>
              {`{${name}}`}
            </button>
          ))}
        </div>
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 14 }}>
        {TEMPLATE_FIELDS.map((field) => (
          <div key={field} onFocusCapture={() => setFocus(field)}>
            <TextField
              label={LABELS[field]}
              value={fields[field]}
              onChange={(next) => setFields((current) => ({ ...current, [field]: next }))}
              placeholder={placeholders[field]}
              multiline={field === "description" || field === "intro"}
              max={TEMPLATE_LIMITS[field]}
              min={field === "title" ? TITLE_RANGE[0] : field === "description" ? DESCRIPTION_RANGE[0] : undefined}
              error={errors[field]?.[0]}
            />
          </div>
        ))}
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>How it looks in Google</h2>
        <SerpPreview title={shown("title")} description={shown("description")} url={`${siteName.toLowerCase().replace(/\s+/g, "")}.in/${categorySlug || "category"}/${sampleCity.toLowerCase().replace(/\s+/g, "-")}/`} />
        <p className="adm-field-help" style={{ margin: 0 }}>
          H1: <strong>{shown("h1") || "(none)"}</strong>
        </p>
      </section>

      {warnings.length ? (
        <Notice kind="warn" title="Things to check">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {warnings.map((item) => (
              <li key={`${item.field}-${item.text}`}>{item.text}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {categorySlug && savedFields ? (
        <div>
          <button type="button" className="adm-btn adm-btn-danger" onClick={remove} disabled={busy}>
            Delete this category template
          </button>
        </div>
      ) : null}
      <SaveBar dirty={dirty} busy={busy} onSaveDraft={save} message={message || undefined} />
    </div>
  );
}
