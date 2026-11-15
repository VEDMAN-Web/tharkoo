"use client";

import { useRef } from "react";

interface Props {
  /** A label for the group, read by screen readers. */
  label: string;
  /** The picture as it is cropped on the site, for example "1920 / 700" (computer) or "3 / 4" (phone). */
  aspect: string;
  src: string;
  x: number;
  y: number;
  onChange: (next: { x: number; y: number }) => void;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * H7.4c: click the picture where the important part is (the face). The site crops the picture around that point.
 * The two number boxes do the same thing from the keyboard.
 */
export function FocalPicker({ label, aspect, src, x, y, onChange }: Props) {
  const frame = useRef<HTMLDivElement>(null);

  function setFromPointer(clientX: number, clientY: number) {
    const box = frame.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    onChange({
      x: clampPercent(((clientX - box.left) / box.width) * 100),
      y: clampPercent(((clientY - box.top) / box.height) * 100),
    });
  }

  return (
    <div className="grid gap-2">
      <p className="font-semibold">{label}</p>
      <p className="t-small text-muted">Click the picture on the spot that must stay in view. The site crops around that point, so faces are not cut.</p>
      {src ? (
        <div
          ref={frame}
          role="img"
          aria-label={`${label}: click to set the focus point. Now ${x}% from the left and ${y}% from the top.`}
          className="relative w-full cursor-crosshair overflow-hidden rounded-lg border border-line bg-surface"
          style={{ aspectRatio: aspect, maxWidth: 420 }}
          onClick={(event) => setFromPointer(event.clientX, event.clientY)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${x}% ${y}%` }} draggable={false} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${x}%`, top: `${y}%`, background: "#E91E8C" }}
          />
        </div>
      ) : (
        <p className="t-small text-muted">Add a picture first, then click it to set the focus point.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="tk-field w-32">
          Left, %
          <input type="number" min={0} max={100} value={x} onChange={(event) => onChange({ x: clampPercent(Number(event.target.value)), y })} />
        </label>
        <label className="tk-field w-32">
          Top, %
          <input type="number" min={0} max={100} value={y} onChange={(event) => onChange({ x, y: clampPercent(Number(event.target.value)) })} />
        </label>
      </div>
    </div>
  );
}
