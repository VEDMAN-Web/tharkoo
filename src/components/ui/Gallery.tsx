"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { safePhoto } from "@/lib/media";
import { SmartImage } from "./SmartImage";
import { PlaceholderArt } from "./PlaceholderArt";
import { Dialog } from "./Dialog";
import { IconButton } from "./IconButton";

export function Gallery({
  photos,
  title,
  seed,
  category,
}: {
  photos: (string | null | undefined)[];
  title: string;
  seed: string;
  category?: string;
}) {
  const items = photos.map((photo) => safePhoto(photo)).filter((photo): photo is string => Boolean(photo));
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((n) => (n + 1) % Math.max(items.length, 1));
      if (event.key === "ArrowLeft") setIndex((n) => (n - 1 + items.length) % Math.max(items.length, 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items.length]);

  if (!items.length) {
    return (
      <div>
        <div className="aspect-square w-full min-w-0 overflow-hidden rounded-lg md:aspect-[4/3]">
          <PlaceholderArt seed={seed} category={category} />
        </div>
        <p className="t-small mt-2 text-muted">No photos yet</p>
      </div>
    );
  }

  function shift(dir: number) {
    setIndex((n) => (n + dir + items.length) % items.length);
  }

  const frame = (
    <div
      className="relative aspect-square w-full min-w-0 overflow-hidden rounded-lg md:aspect-[4/3]"
      onPointerDown={(event) => setStartX(event.clientX)}
      onPointerUp={(event) => {
        if (startX == null) return;
        const delta = event.clientX - startX;
        if (delta > 40) shift(-1);
        if (delta < -40) shift(1);
        setStartX(null);
      }}
    >
      <SmartImage
        src={items[index]}
        alt={`${title}, photo ${index + 1} of ${items.length}`}
        seed={`${seed}-${index}`}
        category={category}
        width={1200}
        height={900}
        priority={index === 0}
        sizes="(min-width: 1024px) 720px, 100vw"
        className="h-full w-full"
      />
      <p className="absolute bottom-3 right-3 rounded-pill bg-black/60 px-2 py-1 t-caption text-text">{index + 1} / {items.length}</p>
      {items.length > 1 ? (
        <>
          <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
            <IconButton label="Previous photo" onClick={() => shift(-1)}>
              <ChevronLeft />
            </IconButton>
          </div>
          <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
            <IconButton label="Next photo" onClick={() => shift(1)}>
              <ChevronRight />
            </IconButton>
          </div>
        </>
      ) : null}
      <button type="button" className="absolute inset-0 z-[1]" aria-label="Open photo" onClick={() => setOpen(true)} />
    </div>
  );

  return (
    <div className="min-w-0">
      {frame}
      {items.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {items.map((photo, i) => (
            <button key={photo + i} type="button" className="w-16 shrink-0" aria-label={`Photo ${i + 1}`} onClick={() => setIndex(i)}>
              <SmartImage src={photo} alt="" seed={`${seed}-t-${i}`} category={category} width={64} height={64} sizes="64px" />
            </button>
          ))}
        </div>
      ) : null}
      <Dialog open={open} title="Photos" onClose={() => setOpen(false)}>
        <SmartImage
          src={items[index]}
          alt={`${title}, photo ${index + 1} of ${items.length}`}
          seed={`${seed}-full-${index}`}
          category={category}
          width={1200}
          height={900}
          sizes="100vw"
        />
        <div className="mt-3 flex items-center justify-between">
          <IconButton label="Previous photo" onClick={() => shift(-1)}>
            <ChevronLeft />
          </IconButton>
          <p className="t-small">{index + 1} / {items.length}</p>
          <IconButton label="Next photo" onClick={() => shift(1)}>
            <ChevronRight />
          </IconButton>
        </div>
      </Dialog>
    </div>
  );
}
