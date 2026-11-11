"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { safePhoto } from "@/lib/media";
import { PlaceholderArt } from "./PlaceholderArt";

export function SmartImage({
  src,
  alt,
  seed,
  category,
  width,
  height,
  priority,
  sizes,
  className,
  rounded,
  fit = "cover",
}: {
  src?: string | null;
  alt: string;
  seed: string;
  category?: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
  className?: string;
  rounded?: string;
  fit?: "cover" | "contain";
}) {
  const safe = safePhoto(src);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const show = Boolean(safe) && !failed;
  return (
    <div
      className={cn("relative overflow-hidden bg-[var(--letterbox)]", className)}
      style={{
        aspectRatio: `${width} / ${height}`,
        borderRadius: rounded,
      }}
    >
      {show ? (
        <Image
          src={safe as string}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes || `${width}px`}
          priority={priority}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className={cn("tk-fade-img", loaded && "is-loaded", fit === "contain" ? "h-full w-full object-contain" : "h-full w-full object-cover")}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <PlaceholderArt seed={seed} category={category} label={alt || undefined} decorative={!alt} />
      )}
      {show && !loaded ? <span className="shimmer absolute inset-0" aria-hidden /> : null}
    </div>
  );
}
