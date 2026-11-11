"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { visibleGroups, type NavItem } from "./nav";

type Viewer = { name: string; roles: readonly string[] };

const ViewerContext = createContext<Viewer>({ name: "", roles: [] });

/** Mounted once in `src/app/admin/layout.tsx` so every admin page knows who is signed in. */
export function AdminViewerProvider({ name, roles, children }: { name: string; roles: readonly string[]; children: React.ReactNode }) {
  return <ViewerContext.Provider value={{ name, roles }}>{children}</ViewerContext.Provider>;
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="adm-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function isActive(pathname: string, entry: NavItem) {
  if (entry.href === "/admin/") return pathname === "/admin/" || pathname === "/admin";
  return pathname.startsWith(entry.href.replace(/\/$/, ""));
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { roles } = useContext(ViewerContext);
  const pathname = usePathname() || "/admin/";
  return (
    <nav className="adm-nav">
      {visibleGroups(roles).map((group) => (
        <div key={group.id} className="adm-group">
          <p className="adm-group-label">{group.label}</p>
          {group.items.map((entry) => {
            const active = isActive(pathname, entry);
            return (
              <Link
                key={entry.id}
                href={entry.href}
                className={`adm-link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={entry.label}
                onClick={onNavigate}
              >
                <NavIcon d={entry.icon} />
                <span className="adm-link-label">{entry.label}</span>
                {entry.task ? <span className="adm-soon">soon</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { name, roles } = useContext(ViewerContext);
  const [sheet, setSheet] = useState(false);
  return (
    <div className="adm">
      <div className="adm-shell">
        <aside className="adm-side" aria-label="Admin menu">
          <Link href="/admin/" className="adm-brand">
            <span className="adm-brand-mark" aria-hidden>T</span>
            <span className="adm-link-label">Tharkoo admin</span>
          </Link>
          <NavLinks />
        </aside>
        <div className="adm-main">
          <header className="adm-top">
            <button type="button" className="adm-menu-btn" aria-expanded={sheet} aria-controls="adm-sheet" onClick={() => setSheet(true)}>
              <NavIcon d="M4 7h16M4 12h16M4 17h16" />
              <span>Menu</span>
            </button>
            <h1 className="adm-title">{title}</h1>
            <label className="adm-search">
              <span className="adm-sr">Find an ad, user, page</span>
              <NavIcon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />
              <input type="search" placeholder="Find an ad, user, page" autoComplete="off" />
            </label>
            <div className="adm-user">
              <span className="adm-avatar" aria-hidden>{(name || "A").slice(0, 1).toUpperCase()}</span>
              <span className="adm-user-text">
                <strong>{name || "Staff"}</strong>
                <small>{roles.join(", ") || "staff"}</small>
              </span>
              <Link href="/u/logout/" className="adm-user-out">Log out</Link>
            </div>
          </header>
          <div className="adm-content" id="adm-content">{children}</div>
        </div>
      </div>
      {sheet ? (
        <div className="adm-sheet" id="adm-sheet" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" className="adm-sheet-back" aria-label="Close menu" onClick={() => setSheet(false)} />
          <div className="adm-sheet-panel">
            <div className="adm-sheet-head">
              <strong>Menu</strong>
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setSheet(false)}>Close</button>
            </div>
            <NavLinks onNavigate={() => setSheet(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="adm-stat">
      <p className="adm-stat-label">{label}</p>
      <p className="adm-stat-value">{value}</p>
    </div>
  );
}
