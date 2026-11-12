"use client";

import { useState, useTransition } from "react";
import { Notice, SaveBar, Toggle } from "@/components/admin/ui";
import type { IndexingSettings } from "@/server/seo/indexing";
import { saveIndexingAction } from "./actions";

type Props = {
  initial: IndexingSettings;
  categories: { slug: string; name: string }[];
  cities: { slug: string; name: string }[];
};

function numberValue(text: string): number | null {
  const n = Number(text);
  return text.trim() !== "" && Number.isFinite(n) ? n : null;
}

export function IndexingForm({ initial, categories, cities }: Props) {
  const [saved, setSaved] = useState(initial);
  const [settings, setSettings] = useState(initial);
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);

  function setCategory(slug: string, patch: Partial<IndexingSettings["categories"][string]>) {
    setSettings((current) => ({ ...current, categories: { ...current.categories, [slug]: { ...current.categories[slug], ...patch } } }));
  }

  function toggleCity(slug: string, on: boolean) {
    setSettings((current) => ({
      ...current,
      offCities: on ? current.offCities.filter((item) => item !== slug) : [...new Set([...current.offCities, slug])],
    }));
  }

  function save() {
    start(async () => {
      const out = await saveIndexingAction(settings);
      if (out.ok) {
        setSaved(out.settings);
        setSettings(out.settings);
        setErrors({});
        setMessage("Saved. Pages and sitemaps follow the new rules within a minute.");
      } else {
        setErrors(out.fields);
        setMessage(out.message);
      }
    });
  }

  const visibleCities = cities.filter((city) => city.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const field = (name: string) => errors[name]?.[0];

  return (
    <div className="adm-stack">
      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Minimum ads before a page is indexed</h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          A city page with fewer ads than the minimum is set to noindex and left out of the sitemap. Empty means today&apos;s default (3 for city pages, 10 for district pages).
        </p>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label className="adm-field">
            <span className="adm-field-label">City and state pages</span>
            <input className="adm-input" inputMode="numeric" placeholder="3" value={settings.hub ?? ""} onChange={(event) => setSettings({ ...settings, hub: numberValue(event.target.value) })} />
            {field("hub") ? <p className="adm-field-error">{field("hub")}</p> : null}
          </label>
          <label className="adm-field">
            <span className="adm-field-label">District pages</span>
            <input className="adm-input" inputMode="numeric" placeholder="10" value={settings.district ?? ""} onChange={(event) => setSettings({ ...settings, district: numberValue(event.target.value) })} />
            {field("district") ? <p className="adm-field-error">{field("district")}</p> : null}
          </label>
        </div>
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Categories</h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          Switch a category off to hide all its pages from search engines. A number here beats the site-wide number above.
        </p>
        {categories.map((category) => {
          const entry = settings.categories[category.slug] ?? {};
          return (
            <div key={category.slug} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", alignItems: "end", borderTop: "1px solid var(--adm-border)", paddingTop: 12 }}>
              <Toggle label={`${category.name} indexable`} checked={entry.enabled !== false} onChange={(on) => setCategory(category.slug, { enabled: on ? undefined : false })} />
              <label className="adm-field">
                <span className="adm-field-label">City pages min.</span>
                <input className="adm-input" inputMode="numeric" value={entry.hub ?? ""} onChange={(event) => setCategory(category.slug, { hub: numberValue(event.target.value) })} />
              </label>
              <label className="adm-field">
                <span className="adm-field-label">District pages min.</span>
                <input className="adm-input" inputMode="numeric" value={entry.district ?? ""} onChange={(event) => setCategory(category.slug, { district: numberValue(event.target.value) })} />
              </label>
            </div>
          );
        })}
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Launch cities</h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          Cities switched off are noindex and out of the sitemap, together with their district pages. {settings.offCities.length} of {cities.length} are off.
        </p>
        <label className="adm-field" style={{ maxWidth: 320 }}>
          <span className="adm-field-label">Find a city</span>
          <input className="adm-input" value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>
        <div style={{ display: "grid", gap: 6, maxHeight: 360, overflowY: "auto", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {visibleCities.map((city) => (
            <label key={city.slug} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 36 }}>
              <input type="checkbox" checked={!settings.offCities.includes(city.slug)} onChange={(event) => toggleCity(city.slug, event.target.checked)} />
              <span>{city.name}</span>
            </label>
          ))}
        </div>
        {field("offCities") ? <Notice kind="error">{field("offCities")}</Notice> : null}
      </section>
      <SaveBar dirty={dirty} busy={busy} onSaveDraft={save} message={message || undefined} />
    </div>
  );
}
