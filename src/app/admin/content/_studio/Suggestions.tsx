"use client";

import { useEffect, useState } from "react";
import type { LinkSuggestion } from "@/server/content/studio/suggest";
import { suggestLinksAction } from "../actions";

const SUGGEST_DELAY_MS = 1500;

/**
 * Suggested links (H8.31): pages Google can see that the article talks about. "Add link" puts the link on the first free
 * mention of the words in the text. Only pages that are indexable today are offered.
 */
export function Suggestions({ text, onAdd }: { text: string; onAdd: (suggestion: LinkSuggestion) => boolean }) {
  const [items, setItems] = useState<LinkSuggestion[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    let live = true;
    const id = window.setTimeout(async () => {
      const result = await suggestLinksAction(text);
      if (live && result.ok) setItems(result.items);
    }, SUGGEST_DELAY_MS);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [text]);

  return (
    <section className="adm-card adm-st-card" aria-labelledby="st-links-h" data-tk="suggestions">
      <div className="adm-st-cardhead">
        <h2 id="st-links-h">Suggested links</h2>
        <small className="adm-k-help">Only pages Google can see</small>
      </div>
      <div className="adm-st-cardbody">
        {note ? <p className="adm-k-help" role="status">{note}</p> : null}
        {items.length === 0 ? <p className="adm-k-help" data-tk="no-suggestions">Nothing to suggest yet. Write about a city or a category and pages will show here.</p> : null}
        <ul className="adm-st-sugg">
          {items.map((item) => (
            <li key={item.path}>
              <span>
                <strong>&ldquo;{item.phrase}&rdquo; &rarr; {item.label}</strong>
                <small>{item.path} · {item.ads.toLocaleString("en-IN")} {item.ads === 1 ? "ad" : "ads"}</small>
              </span>
              <button
                type="button"
                className="adm-k-btn adm-k-btn-sm"
                aria-label={`Add link to ${item.label}`}
                onClick={() => setNote(onAdd(item) ? `Linked "${item.phrase}" to ${item.label}.` : `"${item.phrase}" is already a link or is not in a paragraph.`)}
              >
                Add link
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
