"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchHref } from "./search-header";

type Suggestion = { kind: "category" | "city" | "ad"; label: string; value: string };

const DEBOUNCE_MS = 200;
const MIN_LENGTH = 2;

export function KeywordField({
  base,
  params,
  defaultValue,
  label,
  placeholder,
  listLabel,
}: {
  base: string;
  params: Record<string, string>;
  defaultValue: string;
  label: string;
  placeholder: string;
  listLabel: string;
}) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || text.trim().length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(text.trim())}`, { signal: controller.signal });
        const body = (await response.json()) as { ok?: boolean; data?: { suggestions?: Suggestion[] } };
        setItems(body.ok ? (body.data?.suggestions ?? []).slice(0, 6) : []);
        setActive(-1);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function go(item: Suggestion) {
    const next = { ...params };
    delete next.page;
    if (item.kind === "category") next.category = item.value;
    else if (item.kind === "city") {
      next.city = item.value;
      delete next.area;
    } else next.q = item.value;
    setOpen(false);
    router.push(searchHref(base, next));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? items.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      go(items[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="tkn-kw" ref={box}>
      <svg className="tkn-kw-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A8124F" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <input
        id={`${listId}-input`}
        aria-label={label}
        type="search"
        name="q"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          typed.current = true;
          if (event.target.value.trim().length < MIN_LENGTH) setItems([]);
          setText(event.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && items.length > 0 ? (
        <ul id={listId} role="listbox" aria-label={listLabel} className="tkn-kw-list" data-tk="keyword-suggestions">
          {items.map((item, index) => (
            <li
              key={`${item.kind}-${item.value}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? "is-active" : undefined}
              onMouseDown={(event) => {
                event.preventDefault();
                go(item);
              }}
            >
              <span>{item.label}</span>
              <span className="tkn-kw-kind">{item.kind === "ad" ? "" : item.kind}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
