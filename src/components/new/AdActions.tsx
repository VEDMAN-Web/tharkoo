"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { SaveButton } from "@/components/ui/SaveButton";
import { useT } from "@/components/ui/AdCard";
import { useUrlPaths } from "@/components/UrlPaths";
import { reportPath } from "@/lib/urls";

export function AdActions({ slug, publicId, title, place }: { slug: string; publicId: string; title: string; place: string }) {
  const t = useT();
  const paths = useUrlPaths();
  return (
    <div className="tkn-ad-actions" data-tk="ad-actions">
      <SaveButton item={{ id: slug || title, slug, title, place, at: 0 }} label="Save this ad" className="tkn-ad-save" />
      <Link className="tkn-report" href={`${reportPath(paths)}?ad=${publicId || slug}`} prefetch={false}>
        <Flag size={16} aria-hidden="true" focusable="false" />
        {t("ad.report")}
      </Link>
    </div>
  );
}
