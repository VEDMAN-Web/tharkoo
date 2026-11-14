"use client";

import { Notice } from "@/components/admin/ui";
import type { MediaItem } from "./useAdMedia";

interface Props {
  kind: "image" | "video";
  items: MediaItem[];
  limit: number;
  note: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, step: number) => void;
  onCover?: (key: string) => void;
}

const tile = { width: 120, minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 6 } as const;
const thumb = { width: 120, height: 90, objectFit: "cover", borderRadius: 6, background: "var(--adm-surface-2, #eee)" } as const;

function StateLine({ item }: { item: MediaItem }) {
  if (item.state === "uploading") return <span className="adm-field-help">Uploading...</span>;
  if (item.state === "failed") return <span className="adm-field-help" style={{ color: "var(--adm-danger, #b00020)" }}>{item.error}</span>;
  return <span className="adm-field-help">Ready</span>;
}

function Tile({ item, index, count, kind, onRemove, onMove, onCover }: { item: MediaItem; index: number; count: number; kind: "image" | "video"; onRemove: (key: string) => void; onMove: (key: string, step: number) => void; onCover?: (key: string) => void }) {
  return (
    <li style={tile}>
      {kind === "image" && item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={item.previewUrl} alt={`Photo ${index + 1}: ${item.name}`} style={thumb} />
      ) : (
        <div style={{ ...thumb, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
          {kind === "video" ? "Video" : "Photo"}
        </div>
      )}
      <span className="adm-field-help" style={{ overflowWrap: "anywhere" }}>
        {index === 0 && kind === "image" ? "Cover. " : ""}
        {item.name}
      </span>
      <StateLine item={item} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {index > 0 ? (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onMove(item.key, -1)} aria-label={`Move ${item.name} earlier`}>
            Up
          </button>
        ) : null}
        {index < count - 1 ? (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onMove(item.key, 1)} aria-label={`Move ${item.name} later`}>
            Down
          </button>
        ) : null}
        {onCover && index > 0 ? (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onCover(item.key)} aria-label={`Make ${item.name} the cover`}>
            Make cover
          </button>
        ) : null}
        <button type="button" className="adm-btn adm-btn-danger" onClick={() => onRemove(item.key)} aria-label={`Remove ${item.name}`}>
          Remove
        </button>
      </div>
    </li>
  );
}

/** Choose many at once, see thumbnails, remove, make cover and reorder. Each file uploads as it is chosen. */
export function AdMediaPicker({ kind, items, limit, note, disabled, onFiles, onRemove, onMove, onCover }: Props) {
  const label = kind === "image" ? "Photos" : "Videos";
  const accept = kind === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm,video/quicktime";
  const full = items.length >= limit;
  return (
    <div className="adm-stack" style={{ minWidth: 0 }}>
      <div className="adm-field-label">
        {label} ({items.length} of {limit})
      </div>
      <input
        type="file"
        multiple
        accept={accept}
        disabled={disabled || full}
        aria-label={`Choose ${label.toLowerCase()}`}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        style={{ maxWidth: "100%" }}
      />
      <p className="adm-field-help">
        {kind === "image"
          ? "jpeg, png or webp, up to 8 MB each. The first photo is the cover."
          : "Up to 2 videos: mp4, webm or mov, up to 10 MB and 30 seconds each."}
      </p>
      {note ? <Notice kind="info">{note}</Notice> : null}
      {items.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {items.map((item, index) => (
            <Tile key={item.key} item={item} index={index} count={items.length} kind={kind} onRemove={onRemove} onMove={onMove} onCover={onCover} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
