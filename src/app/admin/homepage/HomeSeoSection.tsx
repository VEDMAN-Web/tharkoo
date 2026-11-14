"use client";

import { useState, useTransition } from "react";
import { saveHomeSeoForAdmin } from "@/app/admin/content-actions";
import { Notice, SerpPreview, TextField } from "@/components/admin/ui";
import { HOME_DESCRIPTION_LIMITS, HOME_TITLE_LIMITS } from "@/lib/ui/home-seo";

type Saved = { seoTitle: string; seoDescription: string };
type FieldErrors = Partial<Record<keyof Saved, string[]>>;

/** The home page title and description with a search preview and length counters. Saves the same fields the public page reads (H6.10). */
export function HomeSeoSection({ initial, siteLabel }: { initial: Saved; siteLabel: string }) {
  const [saved, setSaved] = useState<Saved>(initial);
  const [title, setTitle] = useState(initial.seoTitle);
  const [description, setDescription] = useState(initial.seoDescription);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = title.trim() !== saved.seoTitle || description.trim() !== saved.seoDescription;

  function save() {
    setNotice(null);
    start(async () => {
      const out = await saveHomeSeoForAdmin({ seoTitle: title, seoDescription: description });
      if (out.ok) {
        setSaved({ seoTitle: out.seoTitle, seoDescription: out.seoDescription });
        setTitle(out.seoTitle);
        setDescription(out.seoDescription);
        setFieldErrors({});
        setNotice({ kind: "info", text: "Saved. The home page now uses this title and description." });
      } else {
        setFieldErrors((out.fields as FieldErrors | undefined) ?? {});
        setNotice({ kind: "error", text: out.message });
      }
    });
  }

  return (
    <section className="adm-card" style={{ display: "grid", gap: 16 }} aria-labelledby="home-seo-heading">
      <div style={{ display: "grid", gap: 4 }}>
        <h2 id="home-seo-heading" style={{ margin: 0, fontSize: 18 }}>
          Page title &amp; description (SEO)
        </h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          The title and description that search engines show for the home page. Aim for a title of {HOME_TITLE_LIMITS.min} to{" "}
          {HOME_TITLE_LIMITS.max} characters and a description of {HOME_DESCRIPTION_LIMITS.min} to {HOME_DESCRIPTION_LIMITS.max}.
        </p>
      </div>
      <TextField
        label="Page title"
        value={title}
        onChange={setTitle}
        min={HOME_TITLE_LIMITS.min}
        max={HOME_TITLE_LIMITS.max}
        error={fieldErrors.seoTitle?.[0]}
        help="Shown in the browser tab and as the blue link in search results."
      />
      <TextField
        label="Page description"
        value={description}
        onChange={setDescription}
        multiline
        min={HOME_DESCRIPTION_LIMITS.min}
        max={HOME_DESCRIPTION_LIMITS.max}
        error={fieldErrors.seoDescription?.[0]}
        help="Shown under the link in search results."
      />
      <SerpPreview title={title} description={description} url={siteLabel} />
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
      <div>
        <button type="button" className="adm-btn" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving..." : "Save page title and description"}
        </button>
      </div>
    </section>
  );
}
