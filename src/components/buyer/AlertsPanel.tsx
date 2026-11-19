"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHelp } from "@/components/help/SectionHelp";
import { api, friendlyError } from "@/lib/ui/api";
import type { SavedSearchRow } from "@/server/alerts/saved-searches";

/** H7.6: Saved search alerts. Lists the signed-in user's saved searches, removes one, or saves a new one. */

type Option = { slug: string; name: string };

/** Pure: a readable label for one saved search. */
export function alertLabel(row: SavedSearchRow, categories: Option[], cities: Option[]): string {
  const category = categories.find((option) => option.slug === row.categorySlug)?.name;
  const city = cities.find((option) => option.slug === row.citySlug)?.name;
  const words = row.q ? `"${row.q}"` : "Any words";
  return [words, category, city].filter(Boolean).join(" · ");
}

export function AlertsPanel({
  rows,
  email,
  categories,
  cities,
}: {
  rows: SavedSearchRow[];
  email: string;
  categories: Option[];
  cities: Option[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // The form is kept by a ref: the event's own currentTarget is already gone when the server answers.
  const formRef = useRef<HTMLFormElement>(null);

  async function remove(id: string) {
    setBusy(true);
    const res = await api(`/api/alerts/${id}`, { method: "DELETE" });
    setBusy(false);
    setNote(res.ok ? "Alert removed." : friendlyError(res.error));
    if (res.ok) router.refresh();
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const res = await api("/api/alerts/", {
      method: "POST",
      body: JSON.stringify({
        email,
        q: String(form.get("q") || ""),
        category: String(form.get("category") || ""),
        city: String(form.get("city") || ""),
      }),
    });
    setBusy(false);
    setNote(res.ok ? "Alert saved. We will email you when a new ad matches." : friendlyError(res.error));
    if (res.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }

  return (
    <div className="up-stack">
      <section aria-labelledby="alerts-list" className={`up-panel up-glass`}>
        <h1 id="alerts-list" className="up-h2">Your alerts</h1>
        <SectionHelp textKey="help.section.alerts" />
        {rows.length === 0 ? (
          <div className="up-empty">
            <p className="up-empty-title">No saved searches yet</p>
            <p className="up-empty-body">Save a search below and we will email {email} when a new ad matches it.</p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((row) => (
              <li key={row.id} className="up-stat-row" style={{ border: "1px solid #ead8f0", borderRadius: 16, padding: "10px 14px", background: "#fff" }}>
                <span style={{ overflowWrap: "anywhere", fontWeight: 600 }}>{alertLabel(row, categories, cities)}</span>
                <button type="button" className="up-btn-ghost" disabled={busy} onClick={() => void remove(row.id)} aria-label={`Remove alert ${alertLabel(row, categories, cities)}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="alerts-new" className={`up-panel up-panel-tight up-glass`}>
        <h2 id="alerts-new" className="up-h2">Save a new search</h2>
        <form ref={formRef} onSubmit={create} className="up-filters up-filters-stack" style={{ marginTop: 12 }}>
          <label className="up-label">
            Words
            <input name="q" maxLength={120} placeholder="Any words" className="up-select" />
          </label>
          <label className="up-label">
            Category
            <select name="category" className="up-select" defaultValue="">
              <option value="">All categories</option>
              {categories.map((option) => (
                <option key={option.slug} value={option.slug}>{option.name}</option>
              ))}
            </select>
          </label>
          <label className="up-label">
            City
            <select name="city" className="up-select" defaultValue="">
              <option value="">All cities</option>
              {cities.map((option) => (
                <option key={option.slug} value={option.slug}>{option.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="up-btn" disabled={busy || !email}>
            Save search
          </button>
        </form>
        <p aria-live="polite" className="up-muted" style={{ marginTop: 12 }}>{note}</p>
      </section>
    </div>
  );
}
