"use client";

import { useEffect, useRef, useState } from "react";

const WIDTHS = { laptop: 1280, phone: 390 } as const;
const HEIGHT = 900;

export type Device = keyof typeof WIDTHS;

/** The saved draft, drawn by the real page code in a frame and scaled to fit the column. Hidden on a phone (UI rules). */
export function Preview({ device, version, reloadKey }: { device: Device; version: number; reloadKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const width = WIDTHS[device];

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const fit = () => setScale(Math.min(1, node.clientWidth / width));
    fit();
    const watcher = new ResizeObserver(fit);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [width]);

  return (
    <div className="adm-pb-preview" data-tk="preview" data-device={device}>
      <div ref={box} className="adm-pb-frame" style={{ height: Math.round(HEIGHT * scale) }}>
        <iframe
          key={reloadKey}
          title={`Preview of the saved draft, ${device} size`}
          src="/admin/page-builder/preview/?embed=1"
          style={{ width, height: HEIGHT, transform: `scale(${scale})` }}
          inert
        />
      </div>
      <p className="adm-pb-note">Draft preview. Visitors see {version > 0 ? `version ${version}` : "today's Home page"} until you publish.</p>
    </div>
  );
}
