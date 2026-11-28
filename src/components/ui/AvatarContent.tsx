"use client";

import { useState, type ReactNode } from "react";

/** What goes inside a round profile mark: the person's photo, or the letter when there is no photo (or it cannot load). */
export function AvatarContent({ src, fallback }: { src?: string | null; fallback: ReactNode }) {
  const [failed, setFailed] = useState("");
  if (!src || failed === src) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="tk-avatar-img" src={src} alt="" onError={() => setFailed(src)} />;
}
