"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import "./pictures.css";
import { Button, MediaPicker, Notice, type MediaPickerHandle, type MediaValue } from "@/components/admin/ui";
import type { PictureInput, PicturesView } from "@/server/layout/catalog-pictures";

export type PictureItem = { id: string; name: string; sub: string; pictures: PicturesView };
export type PictureAnswer = { ok: true; message: string; eventId: string } | { ok: false; message: string };
export type UndoAnswer = { ok: boolean; message: string };

const ALT_MIN = 3;
const ALT_MAX = 125;
const NO_IMAGE: MediaValue = { image: null, phone: null, focusX: 50, focusY: 50 };

function photoValue(item: PictureItem): MediaValue {
  const photo = item.pictures.photo;
  return photo ? { image: photo.image, phone: null, focusX: photo.focusX, focusY: photo.focusY } : NO_IMAGE;
}

function bandValue(item: PictureItem): MediaValue {
  const band = item.pictures.band;
  return band ? { image: band.image, phone: band.phone, focusX: band.focusX, focusY: band.focusY } : NO_IMAGE;
}

function altProblem(value: MediaValue): string | undefined {
  if (!value.image) return undefined;
  const length = value.image.alt.trim().length;
  if (length < ALT_MIN) return "Describe the picture in a few words.";
  if (length > ALT_MAX) return `Use at most ${ALT_MAX} characters.`;
  return undefined;
}

function Editor({ item, noun, save, undo, onSaved }: { item: PictureItem; noun: string; onSaved: (pictures: PicturesView) => void; save: (input: { id: string } & PictureInput) => Promise<PictureAnswer>; undo: (eventId: string) => Promise<UndoAnswer> }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<MediaValue>(photoValue(item));
  const [band, setBand] = useState<MediaValue>(bandValue(item));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "info" | "error"; text: string; eventId?: string } | null>(null);
  const photoRef = useRef<MediaPickerHandle>(null);
  const bandRef = useRef<MediaPickerHandle>(null);
  const photoAlt = altProblem(photo);
  const bandAlt = altProblem(band);

  async function onSave() {
    setNote(null);
    if (photoAlt || bandAlt) {
      setNote({ kind: "error", text: "Add a picture description before saving." });
      (photoAlt ? photoRef : bandRef).current?.focusProblem();
      return;
    }
    setBusy(true);
    const answer = await save({
      id: item.id,
      photo: photo.image ? { assetId: photo.image.assetId, alt: photo.image.alt, focusX: photo.focusX, focusY: photo.focusY } : null,
      band: band.image ? { assetId: band.image.assetId, phoneAssetId: band.phone?.assetId ?? null, alt: band.image.alt, focusX: band.focusX, focusY: band.focusY } : null,
    });
    setBusy(false);
    setNote(answer.ok ? { kind: "info", text: answer.message, eventId: answer.eventId } : { kind: "error", text: answer.message });
    if (answer.ok) {
      onSaved({
        photo: photo.image ? { image: photo.image, focusX: photo.focusX, focusY: photo.focusY } : null,
        band: band.image ? { image: band.image, phone: band.phone, focusX: band.focusX, focusY: band.focusY } : null,
      });
      router.refresh();
    }
  }

  async function onUndo(eventId: string) {
    const answer = await undo(eventId);
    setNote({ kind: answer.ok ? "info" : "error", text: answer.message });
    router.refresh();
  }

  return (
    <div className="adm-pics-editor" data-tk="catalog-pictures-editor">
      <h3 className="adm-pics-name">{item.name}</h3>
      <div className="adm-pics-grid">
        <section aria-label={`Photo of ${item.name}`}>
          <p className="adm-field-help">The photo shows on the home page card and on the {noun} page. It is cropped around the focus point.</p>
          <MediaPicker ref={photoRef} label="Photo" value={photo} onChange={setPhoto} aspect="4 / 3" withPhone={false} error={photoAlt ? { alt: photoAlt } : undefined} />
        </section>
        <section aria-label={`Band of ${item.name}`}>
          <p className="adm-field-help">The band is the wide picture at the top of the {noun} page. A phone picture is optional.</p>
          <MediaPicker ref={bandRef} label="Band" value={band} onChange={setBand} aspect="1920 / 700" withPhone error={bandAlt ? { alt: bandAlt } : undefined} />
        </section>
      </div>
      {note ? (
        <Notice kind={note.kind}>
          {note.text}
          {note.eventId ? (
            <>
              {" "}
              <button type="button" className="adm-pics-undo" onClick={() => void onUndo(note.eventId as string)}>Undo</button>
            </>
          ) : null}
        </Notice>
      ) : null}
      <div className="adm-pics-actions">
        <Button kind="primary" busy={busy} onClick={() => void onSave()}>Save pictures</Button>
      </div>
    </div>
  );
}

/** Photo and band pickers for a category or a place (H8.39). The pictures come from the media library, so deleting one that is used is refused. */
export function CatalogPictures({
  title,
  intro,
  noun,
  items,
  save,
  undo,
  search,
}: {
  title: string;
  intro: string;
  noun: string;
  items: PictureItem[];
  save: (input: { id: string } & PictureInput) => Promise<PictureAnswer>;
  undo: (eventId: string) => Promise<UndoAnswer>;
  search?: (query: string) => Promise<PictureItem[]>;
}) {
  const [pool, setPool] = useState<PictureItem[]>(items);
  const [chosen, setChosen] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const item = pool.find((entry) => entry.id === chosen) ?? null;

  async function find() {
    if (!search) return;
    setBusy(true);
    const found = await search(query.trim());
    setBusy(false);
    setPool(found);
    setChosen(found[0]?.id ?? "");
  }

  return (
    <section className="adm-card" aria-labelledby="catalog-pictures-h" data-tk="catalog-pictures" style={{ margin: "16px 0" }}>
      <h2 id="catalog-pictures-h" className="adm-field-label" style={{ fontSize: 16 }}>{title}</h2>
      <p className="adm-field-help">{intro}</p>
      {search ? (
        <form className="adm-pics-search" onSubmit={(event) => { event.preventDefault(); void find(); }}>
          <label className="adm-field">
            <span className="adm-field-label">{`Find a ${noun}`}</span>
            <input className="adm-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="First letters of the name" />
          </label>
          <Button type="submit" busy={busy}>Search</Button>
        </form>
      ) : null}
      <label className="adm-field" style={{ maxWidth: 360 }}>
        <span className="adm-field-label">{`Choose a ${noun}`}</span>
        <select className="adm-input" value={chosen} onChange={(event) => setChosen(event.target.value)}>
          <option value="">{pool.length ? `Choose a ${noun}` : `No ${noun} found`}</option>
          {pool.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.sub ? `${entry.name} (${entry.sub})` : entry.name}
            </option>
          ))}
        </select>
      </label>
      {item ? (
        <Editor
          key={item.id}
          item={item}
          noun={noun}
          save={save}
          undo={undo}
          onSaved={(pictures) => setPool((current) => current.map((entry) => (entry.id === item.id ? { ...entry, pictures } : entry)))}
        />
      ) : null}
    </section>
  );
}
