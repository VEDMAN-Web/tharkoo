"use client";

import { useState } from "react";
import Link from "next/link";
import { LOGO_RATIO } from "@/lib/brand";

/**
 * The Tharkoo logo as an image, linking to Home. Width and height are set so the page does not shift. If the image
 * cannot load, the small code-side mark and the name are shown instead.
 */
export function BrandLogo({
  src,
  name = "tharkoo",
  height = 40,
  href = "/",
  className = "tkn-logo",
  priority = false,
}: {
  src: string;
  name?: string;
  height?: number;
  href?: string | null;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const width = Math.round(height * LOGO_RATIO);
  const body = failed ? (
    <span className="tkn-brand" data-tk="logo-fallback">
      <span className="tkn-mark" aria-hidden="true">t</span>
      <span className="tkn-brand-name">{name.toLowerCase()}</span>
    </span>
  ) : (
    <img className={className} data-tk="logo" src={src} alt="Tharkoo" width={width} height={height} decoding="async" fetchPriority={priority ? "high" : undefined} onError={() => setFailed(true)} />
  );
  return href ? (
    <Link href={href} className="tkn-logo-link" aria-label="Tharkoo, home">
      {body}
    </Link>
  ) : (
    body
  );
}
