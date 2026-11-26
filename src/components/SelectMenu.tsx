"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./select-menu.css";

type Item = { value: string; label: string; disabled: boolean; group: string };
type Menu = { select: HTMLSelectElement; items: Item[]; active: number; title: string; top: number | null; bottom: number | null; left: number; width: number; max: number };

const MOBILE = "(max-width: 600px)";
const GAP = 6;
/** Set while a field was opened by a click or tap, so the keyboard focus ring does not show for a mouse user (see select-menu.css). */
const POINTER = "data-sm-pointer";
const TYPE_RESET_MS = 700;

function readItems(select: HTMLSelectElement): Item[] {
  const items: Item[] = [];
  const add = (option: HTMLOptionElement, group: string) => items.push({ value: option.value, label: (option.textContent || "").trim() || option.value, disabled: option.disabled, group });
  for (const child of Array.from(select.children)) {
    if (child instanceof HTMLOptionElement) add(child, "");
    else if (child instanceof HTMLOptGroupElement) for (const inner of Array.from(child.children)) if (inner instanceof HTMLOptionElement) add(inner, child.label);
  }
  return items;
}

/** The field's name for the phone sheet: its aria-label, else the text of its <label> without the options. */
function titleOf(select: HTMLSelectElement) {
  const own = select.getAttribute("aria-label");
  if (own) return own;
  const label = select.closest("label") ?? (select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`) : null);
  if (!label) return "";
  const copy = label.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("select, option").forEach((node) => node.remove());
  return (copy.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
}

function plainSelect(target: EventTarget | null): HTMLSelectElement | null {
  if (!(target instanceof HTMLSelectElement)) return null;
  if (target.multiple || target.size > 1 || target.disabled || target.hasAttribute("data-native-select") || target.closest("[data-native-select]")) return null;
  return target;
}

function nextEnabled(items: Item[], from: number, step: 1 | -1) {
  for (let index = from + step; index >= 0 && index < items.length; index += step) if (!items[index].disabled) return index;
  return from;
}

/** Writes the picked value the way a person's pick would, so a React form sees a normal change. */
function pick(select: HTMLSelectElement, value: string) {
  if (select.value === value) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function place(select: HTMLSelectElement, items: Item[]): Pick<Menu, "top" | "bottom" | "left" | "width" | "max"> {
  const rect = select.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - GAP - 10;
  const above = rect.top - GAP - 10;
  const wanted = Math.min(items.length * 44 + 12, 360);
  const up = below < Math.min(wanted, 200) && above > below;
  const width = Math.max(rect.width, 200);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  return up
    ? { top: null, bottom: window.innerHeight - rect.top + GAP, left, width, max: Math.max(160, Math.min(360, above)) }
    : { top: rect.bottom + GAP, bottom: null, left, width, max: Math.max(160, Math.min(360, below)) };
}

/**
 * Every pick list on the public site opens as the site's own menu instead of the browser's grey one (it cannot be styled).
 * The real <select> stays in the page, so forms, autofill, labels and validation work as before; a pick is written back to it as a normal change.
 * On a phone the menu is a bottom sheet with big rows. Add data-native-select to a select (or its parent) to keep the browser's own.
 */
export function SelectMenu() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const menuRef = useRef<Menu | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  useEffect(() => {
    menuRef.current = menu;
  }, [menu]);

  const close = useCallback(() => setMenu(null), []);

  const open = useCallback((select: HTMLSelectElement) => {
    const items = readItems(select);
    if (items.length === 0) return;
    const selected = items.findIndex((item) => item.value === select.value && !item.disabled);
    const active = selected >= 0 ? selected : nextEnabled(items, -1, 1);
    setMenu({ select, items, active, title: titleOf(select), ...place(select, items) });
  }, []);

  useEffect(() => {
    let touch: { x: number; y: number; moved: boolean } | null = null;

    const onMouseDown = (event: MouseEvent) => {
      const current = menuRef.current;
      const target = event.target as HTMLElement | null;
      if (current && target && (list.current?.contains(target) || target.closest?.(".tk-sm-back"))) return;
      const select = event.button === 0 ? plainSelect(event.target) : null;
      if (!select) {
        if (current) close();
        return;
      }
      // Stops the browser's own list from opening.
      event.preventDefault();
      select.setAttribute(POINTER, "");
      select.focus();
      if (current?.select === select) close();
      else open(select);
    };
    const onTouchStart = (event: TouchEvent) => {
      const point = event.touches[0];
      touch = plainSelect(event.target) && point ? { x: point.clientX, y: point.clientY, moved: false } : null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const point = event.touches[0];
      if (touch && point && Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > 10) touch.moved = true;
    };
    const onTouchEnd = (event: TouchEvent) => {
      const select = plainSelect(event.target);
      const tap = touch && !touch.moved;
      touch = null;
      if (!select || !tap || !event.cancelable) return;
      event.preventDefault();
      select.setAttribute(POINTER, "");
      select.focus();
      open(select);
    };

    const onFocusOut = (event: FocusEvent) => {
      if (event.target instanceof HTMLSelectElement) event.target.removeAttribute(POINTER);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const current = menuRef.current;
      // A person who uses the keyboard on a field gets the focus ring back.
      if (event.target instanceof HTMLSelectElement && event.key === "Tab") event.target.removeAttribute(POINTER);
      if (!current) {
        const select = plainSelect(event.target);
        if (select && (event.key === " " || event.key === "F4" || (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")))) {
          event.preventDefault();
          open(select);
        }
        return;
      }
      const { items, active } = current;
      const stop = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      if (event.key === "Escape") {
        stop();
        close();
      } else if (event.key === "Tab") {
        close();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        stop();
        setMenu({ ...current, active: nextEnabled(items, active, event.key === "ArrowDown" ? 1 : -1) });
      } else if (event.key === "Home" || event.key === "End") {
        stop();
        setMenu({ ...current, active: event.key === "Home" ? nextEnabled(items, -1, 1) : nextEnabled(items, items.length, -1) });
      } else if (event.key === "Enter" || event.key === " ") {
        stop();
        if (items[active] && !items[active].disabled) pick(current.select, items[active].value);
        close();
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Type the first letters of a name to jump to it.
        stop();
        const now = Date.now();
        const text = (now - typed.current.at > TYPE_RESET_MS ? "" : typed.current.text) + event.key.toLowerCase();
        typed.current = { text, at: now };
        const found = items.findIndex((item) => !item.disabled && item.label.toLowerCase().startsWith(text));
        if (found >= 0) setMenu({ ...current, active: found });
      }
    };

    const onScroll = (event: Event) => {
      if (menuRef.current && !(event.target instanceof Node && list.current?.contains(event.target))) close();
    };

    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
    document.addEventListener("touchend", onTouchEnd, { capture: true });
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  // The highlighted row stays in view when it moves with the arrow keys.
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [menu?.active, menu?.select]);

  if (!menu) return null;
  const phone = typeof window !== "undefined" && window.matchMedia(MOBILE).matches;
  const host = menu.select.closest<HTMLElement>('[role="dialog"], dialog') ?? document.body;
  const style = {
    "--sm-top": menu.top === null ? "auto" : `${menu.top}px`,
    "--sm-bottom": menu.bottom === null ? "auto" : `${menu.bottom}px`,
    "--sm-left": `${menu.left}px`,
    "--sm-width": `${menu.width}px`,
    "--sm-max": `${menu.max}px`,
  } as React.CSSProperties;
  // A group title shows above the first option of each <optgroup>.
  const headings = menu.items.map((item, index) => (item.group && item.group !== (menu.items[index - 1]?.group ?? "") ? item.group : ""));
  return createPortal(
    <>
      <div
        className="tk-sm-back"
        aria-hidden="true"
        onMouseDown={(event) => {
          event.preventDefault();
          close();
        }}
        onTouchEnd={(event) => {
          if (event.cancelable) event.preventDefault();
          close();
        }}
      />
      <div className="tk-sm" style={style} data-tk="select-menu" data-phone={phone ? "yes" : undefined}>
        {menu.title ? <p className="tk-sm-title">{menu.title}</p> : null}
        <ul ref={list} role="listbox" aria-label={menu.title || "Choose"} className="tk-sm-list">
          {menu.items.map((item, index) => {
            const heading = headings[index];
            return (
              <li key={`${item.value}|${index}`} role="presentation" className="tk-sm-row">
                {heading ? <span className="tk-sm-group">{heading}</span> : null}
                <span
                  role="option"
                  aria-selected={item.value === menu.select.value}
                  aria-disabled={item.disabled || undefined}
                  data-active={index === menu.active ? "true" : undefined}
                  className="tk-sm-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (item.disabled) return;
                    pick(menu.select, item.value);
                    close();
                    menu.select.focus();
                  }}
                  onMouseEnter={() => !item.disabled && setMenu((now) => (now ? { ...now, active: index } : now))}
                >
                  <span className="tk-sm-label">{item.label}</span>
                  {item.value === menu.select.value ? (
                    <svg className="tk-sm-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>,
    host,
  );
}
