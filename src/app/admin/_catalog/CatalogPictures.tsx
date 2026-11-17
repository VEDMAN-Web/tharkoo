"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import "./pictures.css";
import { FocalPicker } from "@/components/admin/FocalPicker";
import { Badge, Button, Notice } from "@/components/admin/ui";
import { ImagePicker, type ImageRef } from "@/components/admin/ui/ImagePicker";
import { UPLOAD_RULES } from "@/components/upload/rules";
import type { PictureInput, PicturesView } from "@/server/layout/catalog-pictures";

export type PictureItem = { id: string; name: string; sub: string; pictures: PicturesView };
export type PictureAnswer = { ok: true; message: string; eventId: string } | { ok: false; message: string };
export type UndoAnswer = { ok: boolean; message: string };

const ALT_MIN = 3;
const ALT_MAX = 125;

type Slot = { image: ImageRef | null; alt: string; focusX: number; focusY: number };
const EMPTY: Slot = { image: null, alt: "", focusX: 50, focusY: 50 };

function slotOf(view: PicturesView["photo"] | PicturesView["band"]): Slot {
  return view ? { image: view.image, alt: view.image.alt, focusX: view.focusX, focusY: view.focusY } : EMPTY;
}

function altProblem(slot: Slot): string {
  if (!slot.image) return "";
  const length = slot.alt.trim().length;
  if (length < ALT_MIN) return "Describe the picture in a few words.";
  if (length > ALT_MAX) return `Use at most ${ALT_MAX} characters.`;
  return "";
}

/** One clear box for one picture: its name, what it is for, the picker with the size help (i), the description and the point that must stay in view. */
function PictureBox({ title, purpose, rule, aspect, slot, onChange, noAlt, noFocus, error }: {
  title: string;
  purpose: string;
  rule: (typeof UPLOAD_RULES)[keyof typeof UPLOAD_RULES];
  aspect: string;
  slot: Slot;
  onChange: (next: Slot) => void;
  noAlt?: boolean;
  noFocus?: boolean;
  error?: string;
}) {
  return (
    <section className="adm-pics-box" aria-label={title} data-tk="picture-box" data-slot={title}>
      <h4 className="adm-pics-boxtitle">{title}</h4>
      <p className="adm-field-help">{purpose}</p>
      <ImagePicker
        label={`${title} picture`}
        rule={rule}
        value={slot.image}
        onChange={(image) => onChange(image ? { ...slot, image, alt: slot.alt || image.alt.slice(0, ALT_MAX) } : EMPTY)}
      />
      {slot.image && !noAlt ? (
        <div className="adm-k-field">
          <label className="adm-k-label adm-k-lab" htmlFor={`alt-${title}`}>
            <span>Describe the picture <span className="adm-k-req" aria-hidden="true">*</span></span>
            <span className="adm-k-count">{slot.alt.length} / {ALT_MAX}</span>
          </label>
          <input id={`alt-${title}`} className="adm-k-input" value={slot.alt} maxLength={ALT_MAX + 40} required aria-invalid={error ? true : undefined} onChange={(event) => onChange({ ...slot, alt: event.target.value })} />
          <p className="adm-k-help">Say what the picture shows, for people who cannot see it.</p>
          {error ? <p className="adm-k-err" role="alert">{error}</p> : null}
        </div>
      ) : null}
      {slot.image && !noFocus ? <FocalPicker label={`${title}: the part that must stay in view`} aspect={aspect} src={slot.image.src} x={slot.focusX} y={slot.focusY} onChange={(point) => onChange({ ...slot, focusX: point.x, focusY: point.y })} /> : null}
    </section>
  );
}

function Editor({ item, noun, save, undo, onSaved }: { item: PictureItem; noun: string; onSaved: (pictures: PicturesView) => void; save: (input: { id: string } & PictureInput) => Promise<PictureAnswer>; undo: (eventId: string) => Promise<UndoAnswer> }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<Slot>(slotOf(item.pictures.photo));
  const [band, setBand] = useState<Slot>(slotOf(item.pictures.band));
  const [phone, setPhone] = useState<ImageRef | null>(item.pictures.band?.phone ?? null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [note, setNote] = useState<{ kind: "info" | "error"; text: string; eventId?: string } | null>(null);
  const photoProblem = altProblem(photo);
  const bandProblem = altProblem(band);
  const phoneProblem = phone && !band.image ? `Add the wide ${noun} band first. The phone picture goes with it.` : "";

  async function onSave() {
    setNote(null);
    setTried(true);
    if (photoProblem || bandProblem || phoneProblem) {
      setNote({ kind: "error", text: phoneProblem || "Add a picture description before saving." });
      return;
    }
    setBusy(true);
    const answer = await save({
      id: item.id,
      photo: photo.image ? { assetId: photo.image.assetId, alt: photo.alt.trim(), focusX: photo.focusX, focusY: photo.focusY } : null,
      band: band.image ? { assetId: band.image.assetId, phoneAssetId: phone?.assetId ?? null, alt: band.alt.trim(), focusX: band.focusX, focusY: band.focusY } : null,
    });
    setBusy(false);
    setNote(answer.ok ? { kind: "info", text: answer.message, eventId: answer.eventId } : { kind: "error", text: answer.message });
    if (answer.ok) {
      onSaved({
        photo: photo.image ? { image: { ...photo.image, alt: photo.alt.trim() }, focusX: photo.focusX, focusY: photo.focusY } : null,
        band: band.image ? { image: { ...band.image, alt: band.alt.trim() }, phone, focusX: band.focusX, focusY: band.focusY } : null,
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
      <div className="adm-pics-grid">
        <PictureBox title="Card photo" purpose={`Shows on the home page card and in the ${noun} lists. Cropped to a 3:2 card (4:5 on phones).`} rule={UPLOAD_RULES.categoryCard} aspect="3 / 2" slot={photo} onChange={setPhoto} error={tried ? photoProblem : ""} />
        <PictureBox title="Band, computers" purpose={`The wide picture at the top of the ${noun} page on computers.`} rule={UPLOAD_RULES.categoryBand} aspect="1600 / 500" slot={band} onChange={setBand} error={tried ? bandProblem : ""} />
        <PictureBox
          title="Band, phones"
          purpose="Optional. A tall picture phones show instead of the wide one. Without it, phones crop the wide picture."
          rule={UPLOAD_RULES.categoryBandPhone}
          aspect="4 / 5"
          slot={{ image: phone, alt: "", focusX: 50, focusY: 50 }}
          onChange={(next) => setPhone(next.image)}
          noAlt
          noFocus
          error={tried ? phoneProblem : ""}
        />
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

function Status({ done, label }: { done: boolean; label: string }) {
  return <Badge tone={done ? "ok" : "neutral"}>{`${label}: ${done ? "set" : "missing"}`}</Badge>;
}

/** The picture boxes for categories or places (H8.39): one row for each, with what is set and what is missing, and three clear boxes when you open it. */
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
  const [open, setOpen] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  async function find() {
    if (!search) return;
    setBusy(true);
    const found = await search(query.trim());
    setBusy(false);
    setPool(found);
    setOpen("");
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
      {pool.length === 0 ? <p className="adm-field-help" data-tk="pictures-none">{`No ${noun} found.`}</p> : null}
      <ul className="adm-pics-list">
        {pool.map((entry) => {
          const isOpen = open === entry.id;
          return (
            <li key={entry.id} className="adm-pics-row" data-tk="pictures-row" data-open={isOpen ? "yes" : "no"}>
              <div className="adm-pics-rowhead">
                <span className="adm-pics-rowname">
                  <strong>{entry.name}</strong>
                  {entry.sub ? <small>{entry.sub}</small> : null}
                </span>
                <span className="adm-pics-status">
                  <Status done={Boolean(entry.pictures.photo)} label="Card" />
                  <Status done={Boolean(entry.pictures.band)} label="Band" />
                  <Status done={Boolean(entry.pictures.band?.phone)} label="Phone" />
                </span>
                <Button size="sm" aria-expanded={isOpen} aria-controls={`pics-${entry.id}`} onClick={() => setOpen(isOpen ? "" : entry.id)}>
                  {isOpen ? "Close" : "Edit pictures"}
                </Button>
              </div>
              {isOpen ? (
                <div id={`pics-${entry.id}`}>
                  <Editor
                    key={entry.id}
                    item={entry}
                    noun={noun}
                    save={save}
                    undo={undo}
                    onSaved={(pictures) => setPool((current) => current.map((row) => (row.id === entry.id ? { ...row, pictures } : row)))}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
