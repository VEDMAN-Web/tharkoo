"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroBlock } from "@/components/blocks/HeroBlock";
import type { Props } from "./fields";

type HeroProps = ComponentProps<typeof HeroBlock>;

const PHONE = { width: 390, height: 780 };
const PREVIEW_DELAY_MS = 250;
const DESKTOP = { width: 1440, height: 640 };

/** This page's stylesheets, so each frame shows the real hero CSS. */
function pageStyles(): string {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("");
}

/** The styles never change while the editor is open, so nothing to subscribe to. The server render has none. */
const noSubscribe = () => () => {};

function frameDocument(styles: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles}<style>html,body{margin:0;background:#fff;}</style></head><body>${body}</body></html>`;
}

/** A frame at its real width. The frame scales down to fit the editor; the media queries still see the real width. */
function PreviewFrame({ srcDoc, size, title, className }: { srcDoc: string; size: { width: number; height: number }; title: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, element.clientWidth / size.width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [size.width]);
  return (
    <div ref={ref} className={className} style={{ height: size.height * scale }}>
      <iframe
        title={title}
        srcDoc={srcDoc}
        width={size.width}
        height={size.height}
        sandbox=""
        tabIndex={-1}
        style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
      />
    </div>
  );
}

/** Live preview of the hero at phone and desktop width. Updates as the fields change. */
export function HeroPreview({ props }: { props: Props }) {
  const styles = useSyncExternalStore(noSubscribe, pageStyles, () => "");
  const body = renderToStaticMarkup(<HeroBlock {...(props as HeroProps)} preview />);
  const live = frameDocument(styles, body);
  // Frames reload when their document changes, so wait a moment after the last edit.
  const [srcDoc, setSrcDoc] = useState(live);
  useEffect(() => {
    const timer = window.setTimeout(() => setSrcDoc(live), PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [live]);
  return (
    <div className="lay-preview">
      <span className="adm-field-label">Preview</span>
      <PreviewFrame srcDoc={srcDoc} size={DESKTOP} title="Desktop preview" className="lay-preview-frame" />
      <PreviewFrame srcDoc={srcDoc} size={PHONE} title="Phone preview" className="lay-preview-frame lay-preview-phone" />
    </div>
  );
}
