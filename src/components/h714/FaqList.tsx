"use client";

import type { CSSProperties } from "react";
import { useState } from "react";

export type FaqItem = { q: string; a: string };

const BOX_STYLE: CSSProperties = { maxWidth: "880px", borderRadius: "20px", overflow: "hidden", background: "rgba(255,255,255,.78)", backdropFilter: "blur(18px) saturate(170%)", WebkitBackdropFilter: "blur(18px) saturate(170%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 32px rgba(45,18,72,.08)" };
const ITEM_STYLE: CSSProperties = { borderBottom: "1px solid #F3E8F7" };
const BUTTON_STYLE: CSSProperties = { width: "100%", minHeight: "60px", display: "flex", alignItems: "center", gap: "12px", border: "0", background: "transparent", padding: "0 22px", font: "inherit", fontSize: "16px", fontWeight: "700", color: "#110520", cursor: "pointer", textAlign: "left" };
const LABEL_STYLE: CSSProperties = { flex: "1" };
const ICON_STYLE: CSSProperties = { transform: "rotate(90deg)" };
const ANSWER_STYLE: CSSProperties = { margin: "0", padding: "0 22px 20px", fontSize: "15px", lineHeight: "1.65", color: "#4A2870" };

export function FaqList({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(items.length ? 0 : null);
  return (
    <div style={BOX_STYLE}>
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `faq-panel-${index}`;
        return (
          <div key={item.q} style={ITEM_STYLE}>
            <button
              type="button"
              className="h714-b"
              aria-expanded={open}
              aria-controls={panelId}
              style={BUTTON_STYLE}
              onClick={() => setOpenIndex(open ? null : index)}
            >
              <span style={LABEL_STYLE}>{item.q}</span>
              <span style={{ ...ICON_STYLE, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2185B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6"></path>
                </svg>
              </span>
            </button>
            {open ? (
              <p id={panelId} style={ANSWER_STYLE}>
                {item.a}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
