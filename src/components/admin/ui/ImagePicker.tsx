"use client";

import { useId, useState } from "react";
import { InfoPopover } from "@/components/upload/InfoPopover";
import type { UploadRule } from "@/components/upload/rules";
import { ImagePickerDialog, type PickerRow, type PickerTab } from "./ImagePickerDialog";

/** The shape blocks store for an image (see `image` in src/server/layout/blocks.ts). */
export interface ImageRef {
  assetId: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

const toRef = (row: PickerRow): ImageRef => ({ assetId: row.id, src: row.url, alt: row.alt, width: row.width, height: row.height });

/**
 * Chooses an image from the media library or uploads a new one (alt text is required).
 * Block editors use it for every image field. `banner` (H6.13) names the buttons for a hero banner:
 * choose / replace from the library, upload a new banner, remove the banner.
 * H7.8: `rule` puts the size help under the label with an (i) button, and refuses a file that is too big or the wrong type.
 */
export function ImagePicker({ label, value, onChange, banner = false, rule, hideLabel = false, hidePreview = false }: { label: string; value?: ImageRef | null; onChange: (next: ImageRef | null) => void; banner?: boolean; rule?: UploadRule; hideLabel?: boolean; hidePreview?: boolean }) {
  const uid = useId();
  const [dialog, setDialog] = useState<PickerTab | null>(null);

  function pick(row: PickerRow) {
    onChange(toRef(row));
    setDialog(null);
  }

  return (
    <div className="adm-field">
      <span className="adm-field-label" id={`${uid}-label`} style={hideLabel ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" } : undefined}>{label}</span>
      {rule ? (
        <>
          <p className="adm-field-help" id={`${uid}-line`}>{rule.line}</p>
          <InfoPopover id={`${uid}-info`} label={label}>
            <strong>{label}</strong>
            <ul>
              {rule.details.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </InfoPopover>
        </>
      ) : null}
      {value && !hidePreview ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.src} alt={value.alt} width={72} height={54} style={{ objectFit: "cover", borderRadius: 8 }} />
          <span className="adm-field-help" style={{ flex: 1 }}>{value.alt}</span>
          {banner ? null : (
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      ) : null}
      {banner ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDialog("library")}>
            {value ? "Replace" : "Choose from media library"}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDialog("upload")}>
            Upload new banner
          </button>
          {value ? (
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onChange(null)}>
              Remove banner
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDialog("library")}>
            {value ? "Change image" : "Choose image"}
          </button>
          {value && hidePreview ? (
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onChange(null)}>
              Remove image
            </button>
          ) : null}
        </div>
      )}
      {dialog ? <ImagePickerDialog label={label} value={value} rule={rule} startTab={dialog} onPick={pick} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
