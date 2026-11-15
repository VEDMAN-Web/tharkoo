import Link from "next/link";
import type { ReactNode } from "react";
import "./p10-p13.css";

export const ICON_PATHS = {
  chat: "M4 5h16v11H8l-4 4z",
  phone: "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  pin: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z",
  shield: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4",
  arrow: "M5 12h14M13 6l6 6-6 6",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 20, color = "currentColor", width = 2 }: { name: IconName; size?: number; color?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export function PageBand({ crumbs, title, strong, cover, children }: { crumbs: { label: string; href?: string }[]; title: string; strong?: boolean; cover?: string; children?: ReactNode }) {
  return (
    <section className="tkp-section tkp-band-section">
      <div
        className="tkp-band"
        style={cover ? { backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.88)), url("${cover}")`, backgroundSize: "cover", backgroundPosition: "50% 25%" } : undefined}
      >
        <nav aria-label="Breadcrumb" className="tkp-crumbs">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 ? (
                <>
                  {" "}
                  <span aria-hidden="true">/</span>{" "}
                </>
              ) : null}
              {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}
            </span>
          ))}
        </nav>
        <h1 className={strong ? "tkp-h1 tkp-h1-strong" : "tkp-h1"}>{title}</h1>
        {children}
      </div>
    </section>
  );
}
