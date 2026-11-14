"use client";

import { saveEditorPageTitleAction } from "@/app/admin/seo/page-titles/actions";
import { SeoTitleSection } from "@/components/admin/SeoTitleSection";
import type { SampleVars } from "@/lib/seo/landing";
import type { PageTitleTarget } from "@/lib/seo/page-title-defaults";

/**
 * The title block at the top of the Listing pages and Post-ad page editors (H6.10b). It saves to the
 * same stored value that page reads: a category template or one exact address.
 */
export function PageTitleEditor({
  target,
  initial,
  siteLabel,
  previewVars = null,
  help,
}: {
  target: PageTitleTarget;
  initial: { seoTitle: string; seoDescription: string };
  siteLabel: string;
  previewVars?: SampleVars | null;
  help?: string;
}) {
  return (
    <SeoTitleSection
      headingId="page-title-editor-heading"
      initial={initial}
      siteLabel={siteLabel}
      previewVars={previewVars}
      help={help}
      save={(input) => saveEditorPageTitleAction(target, input)}
    />
  );
}
