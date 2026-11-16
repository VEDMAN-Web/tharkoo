"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { useT } from "@/components/ui/AdCard";
import { useUrlPaths } from "@/components/UrlPaths";
import { reportPath } from "@/lib/urls";

export function AdActions({ slug, publicId, title, place, icons = false }: { slug: string; publicId: string; title: string; place: string; icons?: boolean }) {
  const t = useT();
  const paths = useUrlPaths();
  const href = `${reportPath(paths)}?ad=${publicId || slug}`;
  const item = { id: slug || title, slug, title, place, at: 0 };
  if (icons) {
    return (
      <div className="tkn-ad-actions is-icons" data-tk="ad-actions-icons">
        <SaveButton item={item} className="tkn-ad-save" />
        <Link className="tkn-report" href={href} prefetch={false} aria-label={t("ad.report")}>
          <Flag size={18} aria-hidden="true" focusable="false" />
        </Link>
      </div>
    );
  }
  return (
    <div className="tkn-ad-actions" data-tk="ad-actions">
      <SaveButton item={item} label={t("ad.save")} className="tkn-ad-save" />
      <Link className="tkn-report" href={href} prefetch={false}>
        <Flag size={16} aria-hidden="true" focusable="false" />
        {t("ad.report")}
      </Link>
    </div>
  );
}
