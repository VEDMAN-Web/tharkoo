"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Ellipsis, type LucideIcon } from "lucide-react";
import "@/styles/admin-kit.css";
import { Button, type ButtonKind } from "./Button";

export type Crumb = { label: string; href?: string };
export type MoreItem = { key: string; label: string; icon?: LucideIcon; href?: string; download?: boolean; onSelect?: () => void; danger?: boolean };
export type HeaderAction = { key: string; label: string; icon?: LucideIcon; href?: string; download?: boolean; onClick?: () => void; kind?: ButtonKind; busy?: boolean; disabled?: boolean };

/** The overflow menu: a button with a list. Esc and a click outside close it; the arrow keys move between items. */
export function MoreMenu({ items, phoneItems = [], placement = "down" }: { items: MoreItem[]; phoneItems?: MoreItem[]; placement?: "down" | "up" }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: Event) => {
      if (box.current && event.target instanceof Node && !box.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        box.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const entries = Array.from(box.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []).filter((node) => node.offsetParent !== null);
        const at = entries.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "ArrowDown" ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length;
        event.preventDefault();
        entries[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function renderItem(item: MoreItem, phoneOnly = false) {
    const Icon = item.icon;
    const cls = [item.danger ? "adm-k-menu-danger" : "", phoneOnly ? "adm-k-menu-phone" : ""].filter(Boolean).join(" ");
    const content = (
      <>
        {Icon ? <Icon aria-hidden="true" focusable="false" /> : null}
        {item.label}
      </>
    );
    if (item.href && item.download) {
      return (
        <a key={item.key} role="menuitem" href={item.href} download className={cls || undefined} onClick={() => setOpen(false)}>
          {content}
        </a>
      );
    }
    if (item.href) {
      return (
        <Link key={item.key} role="menuitem" href={item.href} className={cls || undefined} onClick={() => setOpen(false)}>
          {content}
        </Link>
      );
    }
    return (
      <button
        key={item.key}
        type="button"
        role="menuitem"
        className={cls || undefined}
        onClick={() => {
          setOpen(false);
          item.onSelect?.();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`adm-k-more${items.length === 0 ? " is-phone-only" : ""}`} ref={box}>
      <Button icon={Ellipsis} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}>
        More
      </Button>
      {open ? (
        <div className={`adm-k-menu${placement === "up" ? " adm-k-menu-up" : ""}`} role="menu" id={menuId} aria-label="More actions">
          {phoneItems.map((item) => renderItem(item, true))}
          {items.map((item) => renderItem(item))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Page anatomy 3 to 6 (UI-RULES section 1): breadcrumb, one H1, one purpose line (max 72 characters), actions.
 * Actions run More, up to 2 secondary buttons, 1 primary (rightmost). Under 768 px the secondary buttons move into More.
 */
export function PageHeader({
  title,
  purpose,
  crumbs,
  more = [],
  secondary = [],
  primary,
  level = 1,
}: {
  title: string;
  purpose?: string;
  crumbs?: Crumb[];
  more?: MoreItem[];
  secondary?: HeaderAction[];
  primary?: HeaderAction;
  /** 1 on a real screen (exactly one H1). 2 only in a gallery that already has an H1. */
  level?: 1 | 2;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const sec = secondary.slice(0, 2);
  const phoneItems: MoreItem[] = sec.map((action) => ({ key: `sec-${action.key}`, label: action.label, icon: action.icon, href: action.href, download: action.download, onSelect: action.onClick }));
  const showMore = more.length > 0 || phoneItems.length > 0;
  const toButton = (action: HeaderAction, kind: ButtonKind) =>
    action.href ? (
      <Button key={action.key} kind={action.kind ?? kind} icon={action.icon} href={action.href} download={action.download} disabled={action.disabled}>
        {action.label}
      </Button>
    ) : (
      <Button key={action.key} kind={action.kind ?? kind} icon={action.icon} busy={action.busy} disabled={action.disabled} onClick={action.onClick}>
        {action.label}
      </Button>
    );
  return (
    <header className="adm-k-ph adm-k" data-tk="page-header">
      <div className="adm-k-ph-text">
        {crumbs?.length ? (
          <nav className="adm-k-crumb" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`}>
                {index > 0 ? " / " : ""}
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : crumb.label}
              </span>
            ))}
          </nav>
        ) : null}
        <Heading className={level === 2 ? "adm-k-h" : undefined}>{title}</Heading>
        {purpose ? <p className="adm-k-purpose">{purpose}</p> : null}
      </div>
      <div className="adm-k-act">
        {showMore ? <MoreMenu items={more} phoneItems={phoneItems} /> : null}
        {sec.map((action) => (
          <span key={action.key} className="adm-k-act-secondary">
            {toButton(action, "secondary")}
          </span>
        ))}
        {primary ? toButton(primary, "primary") : null}
      </div>
    </header>
  );
}
