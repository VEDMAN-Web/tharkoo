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
    <div style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12.5, color: "#6b7280" }}>Click the picture on the spot that must stay in view. The site crops around that point, so faces are not cut.</p>
      {src ? (
        <div
          ref={frame}
          role="img"
          aria-label={`${label}: click to set the focus point. Now ${x}% from the left and ${y}% from the top.`}
          style={{ position: "relative", width: "100%", maxWidth: 560, aspectRatio: aspect, overflow: "hidden", borderRadius: 8, border: "1px solid #d8dbe5", background: "#f1f2f6", cursor: "crosshair" }}
          onClick={(event) => setFromPointer(event.clientX, event.clientY)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: `${x}% ${y}%` }} draggable={false} />
          <span
            aria-hidden="true"
            style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: 22, height: 22, transform: "translate(-50%, -50%)", borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)", background: "#E91E8C", pointerEvents: "none" }}
          />
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: "#6b7280" }}>Add a picture first, then click it to set the focus point.</p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <label className="tk-field" style={{ display: "grid", gap: 4, width: 128, fontSize: 13, fontWeight: 600 }}>
          Left, %
          <input type="number" min={0} max={100} value={x} onChange={(event) => onChange({ x: clampPercent(Number(event.target.value)), y })} />
        </label>
        <label className="tk-field" style={{ display: "grid", gap: 4, width: 128, fontSize: 13, fontWeight: 600 }}>
          Top, %
          <input type="number" min={0} max={100} value={y} onChange={(event) => onChange({ x, y: clampPercent(Number(event.target.value)) })} />
        </label>
      </div>
    </div>
  );
}
