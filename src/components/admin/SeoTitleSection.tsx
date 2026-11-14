"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Notice, SerpPreview, TextField } from "@/components/admin/ui";
import { renderTemplate, type SampleVars } from "@/lib/seo/landing";
import { HOME_DESCRIPTION_LIMITS, HOME_TITLE_LIMITS } from "@/lib/ui/home-seo";

export interface SeoTitleValues {
  seoTitle: string;
  seoDescription: string;
}

/** What a save returns: the saved text, or a message with the problem for each field. */
export type SeoSaveResult = ({ ok: true } & SeoTitleValues) | { ok: false; message: string; fields?: Record<string, string[]> };

type FieldErrors = Partial<Record<keyof SeoTitleValues, string[]>>;

const DEFAULT_HELP = `The title and description that search engines show for this page. Aim for a title of ${HOME_TITLE_LIMITS.min} to ${HOME_TITLE_LIMITS.max} characters and a description of ${HOME_DESCRIPTION_LIMITS.min} to ${HOME_DESCRIPTION_LIMITS.max}.`;

/**
 * The "Page title & description (SEO)" block used on the Home page, the Listing pages, the Post-ad page and
 * the Page titles tab (H6.10, H6.10b). Counters, a live search preview and the save feedback are the same everywhere;
 * `save` decides where the text goes. `previewVars` fills {variables} in the preview only; the saved text keeps them.
 */
export function SeoTitleSection({
  headingId,
  heading = "Page title & description (SEO)",
  help = DEFAULT_HELP,
  initial,
  siteLabel,
  previewVars = null,
  save,
  footer,
  compact = false,
}: {
  headingId: string;
  heading?: string;
  help?: string;
  initial: SeoTitleValues;
  siteLabel: string;
  previewVars?: SampleVars | null;
  save: (input: SeoTitleValues) => Promise<SeoSaveResult>;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState<SeoTitleValues>(initial);
  const [title, setTitle] = useState(initial.seoTitle);
  const [description, setDescription] = useState(initial.seoDescription);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = title.trim() !== saved.seoTitle || description.trim() !== saved.seoDescription;
  const render = (text: string) => (previewVars ? renderTemplate(text, previewVars) : text);

  function submit() {
    setNotice(null);
    start(async () => {
      const out = await save({ seoTitle: title, seoDescription: description });
      if (out.ok) {
        setSaved({ seoTitle: out.seoTitle, seoDescription: out.seoDescription });
        setTitle(out.seoTitle);
        setDescription(out.seoDescription);
        setFieldErrors({});
        setNotice({ kind: "info", text: "Saved. The page now uses this title and description." });
      } else {
        setFieldErrors((out.fields as FieldErrors | undefined) ?? {});
        setNotice({ kind: "error", text: out.message });
      }
    });
  }

  return (
    <section className={compact ? "adm-stack" : "adm-card"} style={{ display: "grid", gap: 16 }} aria-labelledby={headingId}>
      <div style={{ display: "grid", gap: 4 }}>
        <h2 id={headingId} style={{ margin: 0, fontSize: 18 }}>
          {heading}
        </h2>
        <p className="adm-field-help" style={{ margin: 0 }}>
          {help}
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
      <SerpPreview title={render(title)} description={render(description)} url={siteLabel} />
      {notice ? <Notice kind={notice.kind}>{notice.text}</Notice> : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="adm-btn" onClick={submit} disabled={pending || !dirty}>
          {pending ? "Saving..." : "Save page title and description"}
        </button>
        {footer}
      </div>
    </section>
  );
}
