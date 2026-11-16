"use client";

import { forwardRef, useId, useImperativeHandle, useRef } from "react";
import "@/styles/admin-kit.css";
import { FocalPicker } from "@/components/admin/FocalPicker";
import { ImagePicker, type ImageRef } from "./ImagePicker";
import { ALT_MAX } from "./kit-helpers";

export type MediaValue = {
  image: ImageRef | null;
  /** Optional picture for phones, when the main one crops badly. */
  phone: ImageRef | null;
  /** Focus point, 0 to 100: the site crops around it. */
  focusX: number;
  focusY: number;
};

export type MediaPickerHandle = { focusProblem: () => void };

/**
 * A picture field for admin forms (H8.4): the media library picker (choose or upload), a required picture description
 * (alt text, 125 characters), an optional phone picture and the focus point. A form that refuses to save calls
 * `focusProblem()` so focus lands on the first thing to fix.
 */
export const MediaPicker = forwardRef<MediaPickerHandle, {
  label: string;
  value: MediaValue;
  onChange: (next: MediaValue) => void;
  /** Crop shape on the site, for the focus picker: "1920 / 700". */
  aspect?: string;
  withPhone?: boolean;
  error?: { image?: string; alt?: string };
}>(function MediaPicker({ label, value, onChange, aspect = "4 / 3", withPhone = true, error }, ref) {
  const id = useId();
  const altRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focusProblem() {
      if (error?.alt || value.image) altRef.current?.focus();
      else boxRef.current?.querySelector<HTMLElement>("button")?.focus();
    },
  }));

  const alt = value.image?.alt ?? "";
  return (
    <div className="adm-k-media" data-tk="media-picker" ref={boxRef}>
      <ImagePicker label={label} value={value.image} onChange={(image) => onChange({ ...value, image })} />
      {error?.image ? <p className="adm-k-err" role="alert">{error.image}</p> : null}
      {value.image ? (
        <div className="adm-k-field">
          <label className="adm-k-label adm-k-lab" htmlFor={`${id}-alt`}>
            <span>
              Picture description (alt text)<span className="adm-k-req" aria-hidden="true"> *</span>
            </span>
            <span className="adm-k-count" data-tk="alt-count">{alt.length} / {ALT_MAX}</span>
          </label>
          <input
            id={`${id}-alt`}
            ref={altRef}
            className="adm-k-input"
            required
            maxLength={ALT_MAX + 40}
            value={alt}
            aria-invalid={error?.alt ? true : undefined}
            aria-describedby={`${id}-alth${error?.alt ? ` ${id}-alte` : ""}`}
            onChange={(event) => onChange({ ...value, image: value.image ? { ...value.image, alt: event.target.value } : null })}
          />
          <p className="adm-k-help" id={`${id}-alth`}>Say what the picture shows, for people who cannot see it.</p>
          {error?.alt ? <p className="adm-k-err" id={`${id}-alte`}>{error.alt}</p> : null}
        </div>
      ) : null}
      {value.image && withPhone ? <ImagePicker label={`${label}, phone picture (optional)`} value={value.phone} onChange={(phone) => onChange({ ...value, phone })} /> : null}
      {value.image ? (
        <FocalPicker label={`${label}, focus point`} aspect={aspect} src={value.image.src} x={value.focusX} y={value.focusY} onChange={(point) => onChange({ ...value, focusX: point.x, focusY: point.y })} />
      ) : null}
    </div>
  );
});
