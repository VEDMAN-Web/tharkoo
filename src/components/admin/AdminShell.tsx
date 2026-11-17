"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Ellipsis, House, Menu, MessageSquare, Search, ShieldCheck } from "lucide-react";
import { visibleGroups, type NavItem } from "./nav";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { countLabel, sumCounts, type AdminCounts } from "@/lib/admin/count-sum";
import "@/styles/admin-kit.css";
import { roleWords } from "@/lib/admin/role-words";
import { canOpenPath } from "@/lib/admin/screens";
import { AdminSearchPanel } from "./AdminSearchPanel";
import { NotificationBell } from "./notifications/NotificationBell";

type Viewer = { name: string; roles: readonly string[] };

type Shell = Viewer & { counts: AdminCounts; banner: React.ReactNode };

const ViewerContext = createContext<Shell>({ name: "", roles: [], counts: {}, banner: null });

export const COUNTS_POLL_MS = 60_000;

/** Mounted once in `src/app/admin/layout.tsx` so every admin page knows who is signed in. */
export function AdminViewerProvider({
  name,
  roles,
  counts = {},
  banner = null,
  children,
}: {
  name: string;
  roles: readonly string[];
  counts?: AdminCounts;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  return <ViewerContext.Provider value={{ name, roles, counts, banner }}>{children}</ViewerContext.Provider>;
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="adm-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function isActive(pathname: string, entry: NavItem) {
  if (entry.href === "/admin/") return pathname === "/admin/" || pathname === "/admin";
  return pathname.startsWith(entry.href.replace(/\/$/, ""));
}

/** The live numbers: what the page was drawn with, then a fresh read every 60 s and when the window is focused again. */
function useLiveCounts(initial: AdminCounts) {
  const [counts, setCounts] = useState(initial);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/counts", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { data?: { counts?: AdminCounts } };
      if (body.data?.counts) setCounts(body.data.counts);
    } catch {
      return;
    }
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), COUNTS_POLL_MS);
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  return counts;
}

function NavLinks({ counts, onNavigate }: { counts: AdminCounts; onNavigate?: () => void }) {
  const { roles } = useContext(ViewerContext);
  const pathname = usePathname() || "/admin/";
  return (
    <nav className="adm-nav" aria-label="Admin screens">
      {visibleGroups(roles).map((group) => (
        <div key={group.id} className="adm-group" role="group" aria-label={group.label}>
          <p className="adm-group-label">{group.label}</p>
          {group.items.map((entry) => {
            const active = isActive(pathname, entry);
            const waiting = sumCounts(counts, entry.counts);
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
                {waiting ? (
                  <span className={`adm-count ${entry.phoneBar ? "is-hot" : ""}`} data-tk={`count-${entry.id}`} aria-label={`${waiting} waiting`}>
                    {countLabel(waiting)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function PhoneBar({ counts, onSearch, onMore }: { counts: AdminCounts; onSearch: () => void; onMore: () => void }) {
  const { roles } = useContext(ViewerContext);
  const pathname = usePathname() || "/admin/";
  const review = canOpenPath(roles, "/admin/moderation/");
  const support = canOpenPath(roles, "/admin/support/");
  const reviewCount = sumCounts(counts, ["reviewLive", "reviewHeld", "reviewEdited"]);
  const supportCount = sumCounts(counts, ["tickets"]);
  const here = (href: string) => (href === "/admin/" ? pathname === "/admin/" || pathname === "/admin" : pathname.startsWith(href.replace(/\/$/, "")));
  return (
    <nav className="adm-k-bar" aria-label="Admin shortcuts" data-tk="bottom-bar">
      <Link href="/admin/" aria-current={here("/admin/") ? "page" : undefined}>
        <House aria-hidden="true" focusable="false" />
        Today
      </Link>
      {review ? (
        <Link href="/admin/moderation/" aria-current={here("/admin/moderation/") ? "page" : undefined}>
          <ShieldCheck aria-hidden="true" focusable="false" />
          Review
          {reviewCount ? <span className="adm-k-bar-count" aria-label={`${reviewCount} waiting`}>{countLabel(reviewCount)}</span> : null}
        </Link>
      ) : null}
      {support ? (
        <Link href="/admin/support/" aria-current={here("/admin/support/") ? "page" : undefined}>
          <MessageSquare aria-hidden="true" focusable="false" />
          Support
          {supportCount ? <span className="adm-k-bar-count" aria-label={`${supportCount} waiting`}>{countLabel(supportCount)}</span> : null}
        </Link>
      ) : null}
      <button type="button" onClick={onSearch}>
        <Search aria-hidden="true" focusable="false" />
        Search
      </button>
      <button type="button" onClick={onMore}>
        <Ellipsis aria-hidden="true" focusable="false" />
        More
      </button>
    </nav>
  );
}

/** `hasHeader`: the page draws its own H1 (PageHeader), so the top bar prints the title as plain text. One H1 per page. */
export function AdminShell({ title, hasHeader = false, children }: { title: string; hasHeader?: boolean; children: React.ReactNode }) {
  const { name, roles, counts: initial, banner } = useContext(ViewerContext);
  const counts = useLiveCounts(initial);
  const [sheet, setSheet] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);

  const openSearch = useCallback(() => {
    setSearching(true);
    search.current?.focus();
  }, []);

  useEffect(() => {
    if (searching && document.activeElement !== search.current) search.current?.focus();
  }, [searching]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      openSearch();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSearch]);

  useEffect(() => {
    if (!sheet) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSheet(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  return (
    <div className="adm">
      <a className="adm-skip" href="#adm-content">Skip to content</a>
      <div className="adm-shell">
        <aside className="adm-side" aria-label="Admin menu">
          <Link href="/admin/" className="adm-brand" aria-label="Tharkoo admin">
            <img className="adm-brand-img" src="/brand/logo-mark-512.png" alt="" width={30} height={30} />
            <span className="adm-link-label">Tharkoo admin</span>
          </Link>
          <NavLinks counts={counts} />
        </aside>
        <div className="adm-main">
          <header className="adm-top">
            <button type="button" className="adm-menu-btn" aria-expanded={sheet} aria-controls="adm-sheet" aria-label="Menu" onClick={() => setSheet(true)}>
              <Menu aria-hidden="true" focusable="false" size={20} />
            </button>
            {hasHeader ? <p className="adm-title" data-tk="shell-title">{title}</p> : <h1 className="adm-title">{title}</h1>}
            <div className="adm-searchbox">
            <label className={`adm-search ${searching ? "is-open" : ""}`}>
              <span className="adm-sr">Find an ad, user, page</span>
              <Search aria-hidden="true" focusable="false" size={16} className="adm-search-icon" />
              <input ref={search} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSearching(true); }} onFocus={() => setSearching(true)} placeholder="Find an ad, user, page" autoComplete="off" onBlur={() => setSearching(false)} />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <AdminSearchPanel query={query} input={search} open={searching} onClose={() => { setSearching(false); setQuery(""); search.current?.blur(); }} />
            </div>
            <button type="button" className="adm-ibtn adm-search-btn" aria-label="Search" onClick={openSearch}>
              <Search aria-hidden="true" focusable="false" size={18} />
            </button>
            <NotificationBell />
            <div className="adm-user">
              <span className="adm-avatar" aria-hidden>{(name || "A").slice(0, 1).toUpperCase()}</span>
              <span className="adm-user-text">
                <strong>{name || "Staff"}</strong>
                <small>{roleWords(roles)}</small>
              </span>
              <LogoutButton className="adm-user-out">Log out</LogoutButton>
            </div>
          </header>
          {banner}
          <div className="adm-content" id="adm-content">{children}</div>
        </div>
      </div>
      <PhoneBar counts={counts} onSearch={openSearch} onMore={() => setSheet(true)} />
      {sheet ? (
        <div className="adm-sheet" id="adm-sheet" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" className="adm-sheet-back" aria-label="Close menu" onClick={() => setSheet(false)} />
          <div className="adm-sheet-panel">
            <div className="adm-sheet-head">
              <strong>Menu</strong>
              <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setSheet(false)}>Close</button>
            </div>
            <NavLinks counts={counts} onNavigate={() => setSheet(false)} />
            <LogoutButton className="adm-btn adm-btn-quiet">Log out</LogoutButton>
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
