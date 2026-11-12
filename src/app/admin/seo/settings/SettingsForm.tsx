"use client";

import { useState, useTransition } from "react";
import { Notice, SaveBar, TextField } from "@/components/admin/ui";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import type { AdSchemaMapping } from "@/lib/seo/schema";
import { checkAdSchemaAction, saveSeoSettingsAction } from "./actions";
import { LLMS_LIMITS, MAX_LLMS_SECTIONS, type SeoSettings } from "./rules";

type Props = {
  initial: SeoSettings;
  categories: { id: string; slug: string; name: string }[];
  isSuperadmin: boolean;
};

const MAPPINGS: { value: AdSchemaMapping | ""; label: string }[] = [
  { value: "", label: "Built-in choice for this category" },
  { value: "JobPosting", label: "JobPosting" },
  { value: "Product", label: "Product with price" },
  { value: "none", label: "No structured data" },
];

const asImage = (src: string): ImageRef | null => (src ? { assetId: "", src, alt: "Image", width: 0, height: 0 } : null);

export function SettingsForm({ initial, categories, isSuperadmin }: Props) {
  const [saved, setSaved] = useState(initial);
  const [settings, setSettings] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const err = (name: string) => errors[name]?.[0];
  const org = settings.organization;
  const setOrg = (patch: Partial<SeoSettings["organization"]>) => setSettings({ ...settings, organization: { ...org, ...patch } });

  function save() {
    start(async () => {
      const out = await saveSeoSettingsAction(settings);
      if (out.ok) {
        setSaved(out.settings);
        setSettings(out.settings);
        setErrors({});
        setMessage("Saved. Public files update within a minute.");
      } else {
        setErrors(out.fields);
        setMessage(out.message);
      }
    });
  }

  return (
    <div className="adm-stack">
      <section className="adm-card" style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>robots.txt</h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          The private areas (/u/, /search, /admin/, /api/) are always blocked. Add more paths to block below. The home page, the sitemaps and the site files cannot be blocked.
        </p>
        <label className="adm-field">
          <span className="adm-field-label">Extra Disallow paths, one per line</span>
          <textarea
            className="adm-input"
            rows={4}
            disabled={!isSuperadmin}
            value={settings.robotsDisallow.join("\n")}
            placeholder="/private-page/"
            onChange={(event) => setSettings({ ...settings, robotsDisallow: event.target.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) })}
          />
          {err("robotsDisallow") ? <p className="adm-field-error">{err("robotsDisallow")}</p> : null}
        </label>
        {!isSuperadmin ? <p className="adm-field-help">Only a superadmin can change these lines.</p> : null}
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>llms.txt</h2>
        <TextField label="Introduction" value={settings.llmsIntro} onChange={(next) => setSettings({ ...settings, llmsIntro: next })} multiline max={LLMS_LIMITS.intro} help="Replaces the built-in description at the top. Empty keeps the built-in text." error={err("llmsIntro")} />
        {settings.llmsSections.map((section, index) => (
          <div key={index} className="adm-card" style={{ display: "grid", gap: 8 }}>
            <TextField label={`Section ${index + 1} title`} value={section.title} max={LLMS_LIMITS.sectionTitle} onChange={(next) => setSettings({ ...settings, llmsSections: settings.llmsSections.map((row, i) => (i === index ? { ...row, title: next } : row)) })} />
            <TextField label="Text" value={section.body} multiline max={LLMS_LIMITS.sectionBody} onChange={(next) => setSettings({ ...settings, llmsSections: settings.llmsSections.map((row, i) => (i === index ? { ...row, body: next } : row)) })} />
            <div>
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setSettings({ ...settings, llmsSections: settings.llmsSections.filter((_, i) => i !== index) })}>
                Remove section
              </button>
            </div>
          </div>
        ))}
        {err("llmsSections") ? <p className="adm-field-error">{err("llmsSections")}</p> : null}
        {settings.llmsSections.length < MAX_LLMS_SECTIONS ? (
          <div>
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setSettings({ ...settings, llmsSections: [...settings.llmsSections, { title: "", body: "" }] })}>
              Add a section
            </button>
          </div>
        ) : null}
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Organization (structured data)</h2>
        <TextField label="Name" value={org.name} onChange={(next) => setOrg({ name: next })} placeholder="Tharkoo" error={err("organization.name")} />
        <ImagePicker label="Logo" value={asImage(org.logo)} onChange={(next) => setOrg({ logo: next?.src ?? "" })} />
        {err("organization.logo") ? <p className="adm-field-error">{err("organization.logo")}</p> : null}
        <TextField label="Support email" value={org.email} onChange={(next) => setOrg({ email: next })} error={err("organization.email")} />
        <TextField label="Support phone" value={org.phone} onChange={(next) => setOrg({ phone: next })} />
        <TextField label="Social profiles (https, one per line)" value={org.sameAs.join("\n")} multiline onChange={(next) => setOrg({ sameAs: next.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) })} error={err("organization.sameAs")} />
        <ImagePicker label="Default social share image" value={asImage(settings.defaultOgImage)} onChange={(next) => setSettings({ ...settings, defaultOgImage: next?.src ?? "" })} />
        {err("defaultOgImage") ? <p className="adm-field-error">{err("defaultOgImage")}</p> : null}
      </section>

      <section className="adm-card" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Ad structured data by category</h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          An ad is only given structured data when it has every field Google needs. Check lists the live ads that would be skipped.
        </p>
        {err("adSchema") ? <Notice kind="error">{err("adSchema")}</Notice> : null}
        {categories.map((category) => (
          <CategoryMapping
            key={category.id}
            category={category}
            value={settings.adSchema[category.slug] ?? ""}
            onChange={(value) => {
              const next = { ...settings.adSchema };
              if (value) next[category.slug] = value;
              else delete next[category.slug];
              setSettings({ ...settings, adSchema: next });
            }}
          />
        ))}
      </section>
      <SaveBar dirty={dirty} busy={busy} onSaveDraft={save} message={message || undefined} />
    </div>
  );
}

function CategoryMapping({ category, value, onChange }: { category: { id: string; name: string }; value: AdSchemaMapping | ""; onChange: (next: AdSchemaMapping | "") => void }) {
  const [result, setResult] = useState<{ checked: number; skipped: { slug: string; title: string; missing: string[] }[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function check() {
    setError("");
    start(async () => {
      const out = await checkAdSchemaAction(category.id, value || "none");
      if (out.ok) setResult({ checked: out.checked, skipped: out.skipped });
      else setError(out.message);
    });
  }

  return (
    <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--adm-border)", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label className="adm-field" style={{ flex: "1 1 240px" }}>
          <span className="adm-field-label">{category.name}</span>
          <select className="adm-input" value={value} onChange={(event) => { onChange(event.target.value as AdSchemaMapping | ""); setResult(null); }}>
            {MAPPINGS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="adm-btn adm-btn-quiet" onClick={check} disabled={busy || !value || value === "none"}>
          {busy ? "Checking..." : "Check required fields"}
        </button>
      </div>
      {error ? <p className="adm-field-error">{error}</p> : null}
      {result ? (
        result.skipped.length === 0 ? (
          <p className="adm-field-help" style={{ margin: 0 }}>All {result.checked} live ads checked have the required fields.</p>
        ) : (
          <div>
            <p style={{ margin: "0 0 6px" }}>
              {result.skipped.length} of {result.checked} live ads would be skipped:
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 220, overflowY: "auto" }}>
              {result.skipped.slice(0, 50).map((ad) => (
                <li key={ad.slug} style={{ overflowWrap: "anywhere" }}>
                  {ad.title || ad.slug}: missing {ad.missing.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </div>
  );
}
