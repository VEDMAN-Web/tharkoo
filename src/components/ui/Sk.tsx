import type { CSSProperties } from "react";
import "./sk.css";

/**
 * Loading skeletons for the whole site (no "use client": they work in a server page, a loading.tsx and a client component alike).
 * Each group says what is loading to a screen reader and marks itself busy; the shapes themselves are hidden from it.
 */

type Size = { w?: number | string; h?: number | string };
const px = (value?: number | string) => (typeof value === "number" ? `${value}px` : value);
const sized = ({ w, h }: Size): CSSProperties | undefined => (w || h ? { width: px(w), height: px(h) } : undefined);

/** One shape. Give it a class for the look (sk-line, sk-title, sk-pill, sk-btn, sk-circle, sk-thumb) and a size. */
export function Sk({ kind = "line", w, h, style }: { kind?: "line" | "line-sm" | "title" | "pill" | "btn" | "circle" | "thumb" | "block"; style?: CSSProperties } & Size) {
  const cls = kind === "block" ? "sk" : `sk sk-${kind}`;
  return <span className={cls} style={{ ...sized({ w, h }), ...style }} aria-hidden="true" />;
}

/** The wrapper every skeleton group uses: busy for a screen reader, with the words for what is loading. */
export function SkGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className} data-tk="skeleton">
      <span className="sk-sr">{label}</span>
      {children}
    </div>
  );
}

/** A few lines of text: the last one shorter. */
export function SkLines({ count = 3 }: { count?: number }) {
  return (
    <div className="sk-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Sk key={index} kind="line" w={index === count - 1 && count > 1 ? "62%" : "100%"} />
      ))}
    </div>
  );
}

/** Rows like the video calls, chats and tickets lists: a picture, two lines and a short pill. */
export function SkRows({ label = "Loading", rows = 3, thumb = true }: { label?: string; rows?: number; thumb?: boolean }) {
  return (
    <SkGroup label={label}>
      <ul className="sk-list" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="sk-row">
            {thumb ? <Sk kind="thumb" w={56} h={56} /> : null}
            <span className="sk-stack">
              <Sk kind="line" w="55%" />
              <Sk kind="line-sm" w="80%" />
              <Sk kind="pill" w={90} h={22} />
            </span>
          </li>
        ))}
      </ul>
    </SkGroup>
  );
}

/** The credit packs: four cards in two columns (four across on a wide screen). */
export function SkPacks({ label = "Loading packs", count = 4, wide = false }: { label?: string; count?: number; wide?: boolean }) {
  return (
    <SkGroup label={label}>
      <div className="sk-packs" data-wide={wide ? "yes" : undefined} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="sk-box" style={{ minHeight: 84 }}>
            <Sk kind="title" w="55%" />
            <Sk kind="line-sm" w="80%" />
          </span>
        ))}
      </div>
      <span className="sk" style={{ height: 48, borderRadius: 12, marginTop: 12 }} aria-hidden="true" />
    </SkGroup>
  );
}

/** Plan cards (Promote, Boost). */
export function SkPlans({ label = "Loading plans", count = 3 }: { label?: string; count?: number }) {
  return (
    <SkGroup label={label}>
      <div className="sk-list" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="sk-box" style={{ minHeight: 76 }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <Sk kind="title" w="35%" />
              <Sk kind="line" w="22%" />
            </span>
            <Sk kind="line-sm" w="85%" />
          </span>
        ))}
      </div>
    </SkGroup>
  );
}

/** Three number cards and one card of lines: the earnings and wallet pages. */
export function SkStats({ label = "Loading" }: { label?: string }) {
  return (
    <SkGroup label={label}>
      <div className="sk-stats" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span key={index} className="sk-box" style={{ minHeight: 72 }}>
            <Sk kind="line-sm" w="50%" />
            <Sk kind="title" w="65%" />
          </span>
        ))}
      </div>
      <span className="sk-box" style={{ marginTop: 14 }} aria-hidden="true">
        <Sk kind="title" w="40%" />
        <SkLines count={3} />
      </span>
    </SkGroup>
  );
}

/** A grid of listing cards: photo on top, title and chips below. */
export function SkCards({ label = "Loading ads", count = 6 }: { label?: string; count?: number }) {
  return (
    <SkGroup label={label}>
      <div className="sk-cards" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="sk-card">
            <span className="sk" style={{ aspectRatio: "4 / 5", borderRadius: 0 }} />
            <span className="sk-stack">
              <Sk kind="line" w="75%" />
              <Sk kind="pill" w="55%" h={22} />
            </span>
          </span>
        ))}
      </div>
    </SkGroup>
  );
}

/** A form: a few labelled boxes and a button. */
export function SkForm({ label = "Loading", fields = 3 }: { label?: string; fields?: number }) {
  return (
    <SkGroup label={label}>
      <div className="sk-stack" style={{ gap: 14 }} aria-hidden="true">
        {Array.from({ length: fields }, (_, index) => (
          <span key={index} className="sk-stack" style={{ gap: 6 }}>
            <Sk kind="line-sm" w="30%" />
            <Sk kind="block" h={46} style={{ borderRadius: 12 }} />
          </span>
        ))}
        <Sk kind="btn" />
      </div>
    </SkGroup>
  );
}

/** The account area while a page is on its way: the menu on the left, a heading and rows on the right. Used by loading.tsx. */
export function SkAccountFrame() {
  return (
    <div className="up-wrap" data-tk="account-skeleton">
      <div className="up-page">
        <div className="up-layout">
          <div className="up-glass up-nav sk-nav" aria-hidden="true">
            <span className="sk-row" style={{ border: 0, padding: "6px 8px 12px" }}>
              <Sk kind="circle" w={44} h={44} />
              <span className="sk-stack">
                <Sk kind="line" w="60%" />
                <Sk kind="line-sm" w="45%" />
              </span>
            </span>
            <span className="sk-stack" style={{ gap: 10, padding: "4px 8px 8px" }}>
              {Array.from({ length: 8 }, (_, index) => (
                <Sk key={index} kind="block" h={32} style={{ borderRadius: 12 }} />
              ))}
            </span>
          </div>
          <div className="up-main">
            <section className="up-glass up-panel">
              <SkGroup label="Loading your account">
                <div className="sk-stack" style={{ gap: 16 }} aria-hidden="true">
                  <Sk kind="title" w="40%" />
                  <SkLines count={2} />
                  <SkRowsInner rows={3} />
                </div>
              </SkGroup>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkRowsInner({ rows }: { rows: number }) {
  return (
    <ul className="sk-list">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="sk-row">
          <Sk kind="thumb" w={56} h={56} />
          <span className="sk-stack">
            <Sk kind="line" w="55%" />
            <Sk kind="line-sm" w="80%" />
          </span>
        </li>
      ))}
    </ul>
  );
}
