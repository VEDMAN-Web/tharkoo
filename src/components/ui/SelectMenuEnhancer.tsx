"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import "./select-menu.css";

/**
 * One drop-down look for every plain <select> on the public site.
 * The select stays in the page (so forms, labels, validation and tests work as before). Only its pop-up list is ours:
 * a styled list under the box on a tablet or desktop, a bottom sheet on a phone. A pick sets the select's value and
 * fires its input and change events, so the page code does not change.
 * Not used in the admin (/admin or any "adm-" class) and not for multi-selects. A select can opt out with data-native-select.
 */

type Item =
  | { kind: "group"; key: string; label: string }
  | { kind: "option"; key: string; label: string; value: string; disabled: boolean; selected: boolean };

type Menu = { select: HTMLSelectElement; items: Item[]; title: string; sheet: boolean };
type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const SHEET_MAX_WIDTH = 640;
const LIST_MAX = 288;

function pickable(target: EventTarget | null): HTMLSelectElement | null {
  if (!(target instanceof HTMLSelectElement)) return null;
  if (target.multiple || target.size > 1 || target.disabled) return null;
  if (window.location.pathname.startsWith("/admin")) return null;
  if (target.hasAttribute("data-native-select") || target.closest('[class^="adm-"], [class*=" adm-"]')) return null;
  return target;
}

function titleOf(select: HTMLSelectElement): string {
  const own = select.getAttribute("aria-label") || select.title;
  if (own) return own;
  for (const label of Array.from(select.labels ?? [])) {
    const text = label.contains(select) ? label.querySelector("span")?.textContent : label.textContent;
    if (text && text.trim()) return text.trim();
  }
  return "Choose";
}

function readItems(select: HTMLSelectElement): Item[] {
  const items: Item[] = [];
  const add = (option: HTMLOptionElement, disabled: boolean, key: string) => {
    if (option.hidden) return;
    items.push({ kind: "option", key, label: option.label || option.textContent || option.value, value: option.value, disabled: disabled || option.disabled, selected: option.selected });
  };
  Array.from(select.children).forEach((child, index) => {
    if (child instanceof HTMLOptionElement) add(child, false, `o${index}`);
    else if (child instanceof HTMLOptGroupElement) {
      items.push({ kind: "group", key: `g${index}`, label: child.label });
      Array.from(child.children).forEach((inner, at) => {
        if (inner instanceof HTMLOptionElement) add(inner, child.disabled, `o${index}-${at}`);
      });
    }
  });
  return items;
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  if (select.value === value) return;
  // The native setter, so React's controlled select sees the change like a real pick.
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function placeFor(select: HTMLSelectElement, count: number): Place {
  const rect = select.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(Math.max(rect.width, 180), window.innerWidth - margin * 2);
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
  const below = window.innerHeight - rect.bottom - margin - 6;
  const above = rect.top - margin - 6;
  const want = Math.min(count * 44 + 12, LIST_MAX);
  if (below < Math.min(want, 260) && above > below) return { left, width, bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(120, Math.min(LIST_MAX, above)) };
  return { left, width, top: rect.bottom + 6, maxHeight: Math.max(120, Math.min(LIST_MAX, below)) };
}

export function SelectMenuEnhancer() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<Place | null>(null);
  const menuRef = useRef<Menu | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const close = useCallback((restoreFocus: boolean) => {
    const current = menuRef.current;
    menuRef.current = null;
    setMenu(null);
    if (restoreFocus && current?.select.isConnected) current.select.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function openFor(select: HTMLSelectElement) {
      const items = readItems(select);
      const next: Menu = { select, items, title: titleOf(select), sheet: window.matchMedia(`(max-width: ${SHEET_MAX_WIDTH}px)`).matches };
      const chosen = items.findIndex((item) => item.kind === "option" && item.selected);
      const first = items.findIndex((item) => item.kind === "option" && !item.disabled);
      menuRef.current = next;
      setActive(chosen >= 0 ? chosen : first);
      setMenu(next);
    }
    function onMouseDown(event: MouseEvent) {
      if (event.button !== 0) return;
      const select = pickable(event.target);
      if (!select) return;
      event.preventDefault();
      // A mouse pick must not draw the keyboard focus frame on the select (see select-menu.css).
      select.setAttribute("data-sm-mouse", "");
      select.focus({ preventScroll: true });
      if (menuRef.current?.select === select) close(false);
      else openFor(select);
    }
    function onKeyDown(event: KeyboardEvent) {
      // Keyboard use brings the focus frame back. A bare Ctrl, Shift, Alt or Cmd press (or a shortcut like Ctrl+R) is not keyboard use of the select.
      const modifierOnly = ["Control", "Shift", "Alt", "Meta", "CapsLock"].includes(event.key) || event.ctrlKey || event.metaKey;
      if (!modifierOnly) {
        if (event.key === "Tab") document.querySelectorAll("select[data-sm-mouse]").forEach((el) => el.removeAttribute("data-sm-mouse"));
        else if (event.target instanceof HTMLSelectElement) event.target.removeAttribute("data-sm-mouse");
      }
      if (menuRef.current) return;
      const select = pickable(event.target);
      if (!select) return;
      if (event.key === " " || event.key === "F4" || (event.altKey && event.key === "ArrowDown")) {
        event.preventDefault();
        openFor(select);
      }
    }
    function onPointerDown(event: PointerEvent) {
      const current = menuRef.current;
      if (!current || !(event.target instanceof Node)) return;
      if (current.select.contains(event.target) || popRef.current?.contains(event.target)) return;
      close(false);
    }
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [close]);

  // Place the list under (or above) the select. Like the browser's own list, it closes when the page scrolls behind it.
  useLayoutEffect(() => {
    if (!menu || menu.sheet) return;
    const update = () => {
      if (!menu.select.isConnected) return close(false);
      setPlace(placeFor(menu.select, menu.items.length));
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && popRef.current?.contains(event.target)) return;
      close(false);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu, close]);

  useEffect(() => {
    if (menu) listRef.current?.focus({ preventScroll: true });
  }, [menu]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, menu]);

  if (!menu) return null;

  const optionAt = (index: number) => {
    const item = menu.items[index];
    return item && item.kind === "option" && !item.disabled ? item : null;
  };
  const step = (from: number, direction: 1 | -1) => {
    for (let at = from + direction; at >= 0 && at < menu.items.length; at += direction) if (optionAt(at)) return at;
    return from;
  };
  const choose = (index: number) => {
    const item = optionAt(index);
    if (!item) return;
    setSelectValue(menu.select, item.value);
    close(true);
  };

  function onKey(event: React.KeyboardEvent<HTMLUListElement>) {
    const nativeEvent = event.nativeEvent;
    if (event.key === "Escape") {
      event.preventDefault();
      nativeEvent.stopPropagation();
      close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((now) => step(now, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? step(-1, 1) : step(menu!.items.length, -1));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + event.key.toLowerCase(), at: now };
      const from = typed.current.text.length === 1 ? active + 1 : active;
      const order = [...menu!.items.keys()];
      const hit = [...order.slice(Math.max(from, 0)), ...order.slice(0, Math.max(from, 0))].find((at) => {
        const item = optionAt(at);
        return item ? item.label.trim().toLowerCase().startsWith(typed.current.text) : false;
      });
      if (hit !== undefined) setActive(hit);
    }
  }

  const activeId = active >= 0 ? `tk-sm-opt-${active}` : undefined;
  return createPortal(
    <>
      {menu.sheet ? <div className="tk-sm-backdrop" aria-hidden="true" /> : null}
      <div ref={popRef} className={menu.sheet ? "tk-sm-pop is-sheet" : "tk-sm-pop"} style={menu.sheet || !place ? undefined : place} data-tk="select-menu">
        {menu.sheet ? <p className="tk-sm-title">{menu.title}</p> : null}
        <ul ref={listRef} className="tk-sm-list" role="listbox" tabIndex={-1} aria-label={menu.title} aria-activedescendant={activeId} onKeyDown={onKey}>
          {menu.items.map((item, index) =>
            item.kind === "group" ? (
              <li key={item.key} role="presentation" className="tk-sm-group">{item.label}</li>
            ) : (
              <li
                key={item.key}
                id={`tk-sm-opt-${index}`}
                role="option"
                aria-selected={item.selected}
                aria-disabled={item.disabled || undefined}
                data-active={index === active ? "true" : undefined}
                className="tk-sm-opt"
                onMouseEnter={() => (item.disabled ? undefined : setActive(index))}
                onClick={() => choose(index)}
              >
                <span className="tk-sm-opt-text">{item.label}</span>
                {item.selected ? <Check size={16} aria-hidden="true" focusable="false" className="tk-sm-tick" /> : null}
              </li>
            ),
          )}
        </ul>
      </div>
    </>,
    document.body,
  );
}
