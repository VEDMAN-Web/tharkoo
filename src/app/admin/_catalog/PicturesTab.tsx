"use client";

import { FocalPicker } from "@/components/admin/FocalPicker";
import { ImagePicker } from "@/components/admin/ui/ImagePicker";
import { TextField } from "@/components/admin/ui";
import { MAX_ALT, type PictureDraft, type PictureErrors, type PictureSlot } from "./model";
import { WhereItShows } from "./WhereItShows";

const EMPTY: PictureSlot = { image: null, alt: "", focusX: 50, focusY: 50 };

type Spot = "tile" | "banner" | "phone";

function Box({
  title,
  help,
  spot,
  aspect,
  example,
  slot,
  error,
  noAlt,
  noFocus,
  onChange,
}: {
  title: string;
  help: string;
  spot: Spot;
  aspect: string;
  example: string;
  slot: PictureSlot;
  error?: string;
  noAlt?: boolean;
  noFocus?: boolean;
  onChange: (next: PictureSlot) => void;
}) {
  return (
    <section className="adm-cat-pic" aria-label={title} data-tk="picture-box" data-slot={spot}>
      <header>
        <h3>{title}</h3>
        <p>{help}</p>
      </header>
      <div className="adm-cat-pic-body">
        <div className="adm-cat-pic-where">
          <WhereItShows spot={spot} />
          <small>Where it shows</small>
        </div>
        <div className="adm-cat-pic-main">
          {slot.image ? (
            noFocus ? (
              <div className="adm-cat-pic-still" style={{ aspectRatio: aspect, maxWidth: 260 }} data-tk="picture-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slot.image.src} alt="" />
              </div>
            ) : (
              <div data-tk="picture-preview">
                <FocalPicker label={`${title}: the part that must stay in view`} aspect={aspect} src={slot.image.src} x={slot.focusX} y={slot.focusY} maxWidth={spot === "tile" ? 460 : 720} collapseNumbers onChange={(point) => onChange({ ...slot, focusX: point.x, focusY: point.y })} />
              </div>
            )
          ) : (
            <div className="adm-cat-pic-empty" style={{ aspectRatio: aspect, maxWidth: spot === "tile" ? 360 : spot === "phone" ? 200 : 560 }} data-tk="picture-empty">
              No picture yet
            </div>
          )}
          <div className="adm-cat-picker">
            <ImagePicker
              label={title}
              hideLabel
              hidePreview
              value={slot.image}
              onChange={(image) => onChange(image ? { ...slot, image, alt: slot.alt || image.alt.slice(0, MAX_ALT) } : EMPTY)}
            />
          </div>
          {slot.image && !noAlt ? (
            <TextField
              label="Describe the picture"
              required
              max={MAX_ALT}
              value={slot.alt}
              error={error}
              help={`Say what it shows, for people who cannot see it. Example: ${example}`}
              onChange={(alt) => onChange({ ...slot, alt })}
            />
          ) : null}
          {noAlt && error ? <p className="adm-k-err" role="alert">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}

/** The Pictures tab: three boxes, each with a drawing of where it shows, one help line with the size, the preview at the real crop and its description. */
export function PicturesTab({ draft, errors, onChange, noun = "category" }: { draft: PictureDraft; errors: PictureErrors; onChange: (next: PictureDraft) => void; noun?: string }) {
  return (
    <div className="adm-cat-pics" data-tk="pictures-tab">
      <Box
        title="Home page tile"
        help="Shown as the tile on the Home page. Best size 1200 × 800."
        spot="tile"
        aspect="3 / 2"
        example="A tidy two-room flat with a sofa and a balcony."
        slot={draft.photo}
        error={errors.photo}
        onChange={(photo) => onChange({ ...draft, photo })}
      />
      <Box
        title="Top banner for computers"
        help={`Shown across the top of the page of this ${noun} on a computer. Best size 1600 × 500.`}
        spot="banner"
        aspect="16 / 5"
        example="A bright street of shops in the evening."
        slot={draft.band}
        error={errors.band}
        onChange={(band) => onChange({ ...draft, band })}
      />
      <Box
        title="Top banner for phones (optional)"
        help="Shown at the top on a phone instead of the wide banner. Best size 800 × 1000. Without it, phones crop the wide banner."
        spot="phone"
        aspect="4 / 5"
        example="A tall view of the same shop street."
        slot={{ image: draft.phone, alt: "", focusX: 50, focusY: 50 }}
        error={errors.phone}
        noAlt
        noFocus
        onChange={(slot) => onChange({ ...draft, phone: slot.image })}
      />
    </div>
  );
}
