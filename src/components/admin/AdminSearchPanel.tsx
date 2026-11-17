"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchGroup } from "@/server/admin/search";

const DEBOUNCE_MS = 250;
const MIN = 2;

type State = { query: string; groups: SearchGroup[]; failed: boolean };

/**
 * The results under the top bar search (H8.49): grouped, each row a link. Arrow keys move, Enter opens, Esc closes.
 * The input stays focused while the panel is used; the panel never takes focus itself.
 */
export function AdminSearchPanel({ query, input, open, onClose }: { query: string; input: React.RefObject<HTMLInputElement | null>; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ query: "", groups: [], failed: false });
  const [index, setIndex] = useState(-1);
  const seq = useRef(0);
  const text = query.trim();
  const wanted = open && text.length >= MIN;

  useEffect(() => {
    if (!wanted) return;
    const mine = ++seq.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(text)}`, { credentials: "same-origin", cache: "no-store" });
        const body = (await res.json()) as { ok?: boolean; data?: { groups?: SearchGroup[] } };
        if (mine !== seq.current) return;
        setState({ query: text, groups: res.ok && body.ok ? (body.data?.groups ?? []) : [], failed: !res.ok });
        setIndex(-1);
      } catch {
        if (mine === seq.current) setState({ query: text, groups: [], failed: true });
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, wanted]);

  const flat = useMemo(() => (state.query === text ? state.groups.flatMap((group) => group.items) : []), [state, text]);

  useEffect(() => {
    const node = input.current;
    if (!node || !open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (flat.length === 0) return;
        event.preventDefault();
        setIndex((current) => (event.key === "ArrowDown" ? (current + 1) % flat.length : (current <= 0 ? flat.length - 1 : current - 1)));
      } else if (event.key === "Enter") {
        const target = flat[index >= 0 ? index : 0];
        if (!target) return;
        event.preventDefault();
        onClose();
        router.push(target.href);
      } else if (event.key === "Escape") {
        onClose();
      }
    }
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [flat, index, input, onClose, open, router]);

  if (!wanted) return null;
  const ready = state.query === text;
  let row = -1;
  return (
    <div className="adm-sr-panel" role="region" aria-label="Search results" data-tk="search-panel" onMouseDown={(event) => event.preventDefault()}>
      {!ready ? <p className="adm-sr-note" role="status">Searching...</p> : null}
      {ready && state.failed ? <p className="adm-sr-note" role="alert">Search did not work. Try again.</p> : null}
      {ready && !state.failed && state.groups.length === 0 ? <p className="adm-sr-note" role="status" data-tk="search-empty">Nothing found for &quot;{text}&quot;. Try the exact email, an ad ID or a ticket number.</p> : null}
      {ready
        ? state.groups.map((group) => (
            <section key={group.key} className="adm-sr-group" aria-label={group.label} data-tk={`search-group-${group.key}`}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((item) => {
                  row += 1;
                  const at = row;
                  return (
                    <li key={`${group.key}-${item.id}`}>
                      <a href={item.href} className={`adm-sr-row${at === index ? " is-on" : ""}`} data-tk="search-result" onClick={(event) => { event.preventDefault(); onClose(); router.push(item.href); }}>
                        <strong>{item.title}</strong>
                        <small>{item.sub}</small>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        : null}
    </div>
  );
}
