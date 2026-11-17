"use client";

import { useState } from "react";
import { Button, useToast } from "@/components/admin/ui";
import type { MediaItem } from "@/server/layout/media";
import { saveMediaDetailsAction, undoMediaAction } from "./library-actions";

const ALT_MAX = 125;
const ALT_MIN = 3;

function Row({ item, onSaved }: { item: MediaItem; onSaved: () => void }) {
  const toast = useToast();
  // Nothing is filled in: a description made up by the site would say what nobody checked. A file name stays visible as a hint only.
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const id = `describe-${item.id}`;

  async function save() {
    const text = alt.trim();
    if (text.length < ALT_MIN) return setError("Describe the picture in a few words.");
    if (text.length > ALT_MAX) return setError(`Use at most ${ALT_MAX} characters.`);
    setBusy(true);
    const answer = await saveMediaDetailsAction({ id: item.id, alt: text, phoneMediaId: item.phoneVariantId, focusX: item.focusX, focusY: item.focusY });
    setBusy(false);
    if (!answer.ok) return setError(answer.fields?.alt?.[0] ?? answer.message);
    const eventId = answer.eventId;
    toast.show({ kind: "undo", message: "Description saved.", onUndo: () => void undoMediaAction(eventId).then((undone) => { toast.show({ kind: undone.ok ? "success" : "error", message: undone.message }); onSaved(); }) });
    onSaved();
  }

  return (
    <li className="adm-ml-todo-row" data-tk="describe-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.url} alt="" loading="lazy" />
      <div className="adm-ml-todo-body">
        <small className="adm-ml-todo-hint">{item.alt && item.autoAlt ? `Only the file name so far: ${item.alt}` : "No description yet"}</small>
        <label className="adm-k-label" htmlFor={id}>Describe the picture</label>
        <div className="adm-ml-todo-edit">
          <input id={id} className="adm-k-input" value={alt} maxLength={ALT_MAX + 40} placeholder="Example: A bright living room with a sofa and a window" aria-invalid={error ? true : undefined} onChange={(event) => { setAlt(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Enter") void save(); }} />
          <Button kind="primary" busy={busy} onClick={() => void save()}>Save</Button>
        </div>
        {error ? <p className="adm-k-err" role="alert">{error}</p> : null}
      </div>
    </li>
  );
}

/** The to-do list of the Missing alt tab: every picture with no description, or only one made from its file name, and a box to write the real one. */
export function DescribeList({ items, onSaved }: { items: MediaItem[]; onSaved: () => void }) {
  return (
    <div data-tk="describe-list">
      <p className="adm-ml-todo-intro">{`${items.length === 1 ? "This picture has" : "These pictures have"} no description yet, or only the one made from the file name. Write what each shows. Nothing is filled in for you.`}</p>
      <ul className="adm-ml-todo" aria-label="Pictures to describe">
        {items.map((item) => (
          <Row key={item.id} item={item} onSaved={onSaved} />
        ))}
      </ul>
    </div>
  );
}
