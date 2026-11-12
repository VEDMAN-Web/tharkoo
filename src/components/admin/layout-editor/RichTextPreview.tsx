"use client";

import { createElement, useMemo, type ReactNode } from "react";

/** Tags the preview draws. Everything else is shown as plain text, scripts and styles are dropped. No raw HTML is ever injected. */
const ALLOWED = new Set(["p", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "blockquote"]);
const DROPPED = new Set(["script", "style", "iframe", "object", "embed", "form", "svg", "math", "link", "meta", "base", "template"]);

function safeHref(value: string): string {
  const href = value.trim();
  return /^(https?:\/\/|mailto:)/i.test(href) || /^\/(?!\/)/.test(href) ? href : "";
}

function convert(node: Node, key: string): ReactNode {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROPPED.has(tag)) return null;
  if (tag === "br") return <br key={key} />;
  const kids = Array.from(el.childNodes).map((child, index) => convert(child, `${key}.${index}`));
  if (tag === "a") {
    const href = safeHref(el.getAttribute("href") ?? "");
    return href ? (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer">
        {kids}
      </a>
    ) : (
      <span key={key}>{kids}</span>
    );
  }
  if (ALLOWED.has(tag)) return createElement(tag, { key }, kids);
  return <span key={key}>{kids}</span>;
}

/** Live preview of rich text: parsed with DOMParser (which never runs scripts) and rebuilt from a short allow-list. */
export function RichTextPreview({ html }: { html: string }) {
  const content = useMemo(() => {
    if (!html.trim()) return null;
    if (typeof DOMParser === "undefined") return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.body.childNodes).map((child, index) => convert(child, String(index)));
  }, [html]);
  return (
    <div className="lay-preview" aria-label="Preview">
      {content ?? <span className="adm-field-help">Nothing to preview yet.</span>}
    </div>
  );
}
