"use client";

import { ArrowLeft, ArrowRight, Star, Trash2, type LucideIcon } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { InfoPopover } from "./InfoPopover";
import { fileSize, type UploadRule } from "./rules";
import "./upload.css";

/** One file in the box. The owner of the list decides what the states mean and when a file is saved. */
export type UploadItem = {
  key: string;
  name: string;
  kind: "image" | "video";
  previewUrl?: string;
  state: "uploading" | "ready" | "failed";
  /** 0 to 1 while the file is sent, when the sender can report it. */
  progress?: number;
  /** The file size in bytes, shown on a ready tile. */
  size?: number;
  error?: string;
};

type Props = {
  label: string;
  rule: UploadRule;
  items: UploadItem[];
  limit: number;
  disabled?: boolean;
  /** A short line under the label, e.g. the photos and videos total. */
  hint?: string;
  /** The message from the last add, shown in a live region. */
  note?: string;
  onFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
  /** Moves one file by `step` places. Drag and the Earlier / Later buttons both use it. */
  onMove?: (key: string, step: number) => void;
  /** Makes one file the cover (first). Shown on every file but the first. */
  onCover?: (key: string) => void;
  /** Opens the Media library pop-up on the same screen. Only where the library can fill this box. */
  onPickLibrary?: () => void;
};

const DRAG_TYPE = "application/x-upload-key";

/** The line under a ready tile: its size and "Ready". */
function readyLine(item: UploadItem): string {
  return item.size ? `${fileSize(item.size)} · Ready` : "Ready";
}

function TileButton({ label, icon: Icon, disabled, danger, onClick }: { label: string; icon: LucideIcon; disabled?: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`upl-icon-btn${danger ? " upl-icon-danger" : ""}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon size={16} aria-hidden="true" focusable="false" />
    </button>
  );
}

/**
 * H7.8: the one upload box used by every photo or video field. Drop or choose several files, see each one
 * upload, preview them, remove, drag or move, make cover, and count against the limit. A refused file does not
 * count: it shows its reason and a Remove button only. Nothing is saved here: the owner of the list saves it with the form.
 */
export function UploadBox({ label, rule, items, limit, disabled = false, hint, note, onFiles, onRemove, onMove, onCover, onPickLibrary }: Props) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const lineId = `${uid}-line`;
  const popId = `${uid}-info`;
  const [over, setOver] = useState(false);
  const [dragKey, setDragKey] = useState("");
  const dragRef = useRef("");
  const counted = items.filter((item) => item.state !== "failed").length;
  const full = counted >= limit;
  const off = disabled || full;
  const last = items.length - 1;

  function onDropFiles(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setOver(false);
    if (off || !event.dataTransfer.files.length) return;
    onFiles(Array.from(event.dataTransfer.files));
  }

  function onDropTile(event: DragEvent<HTMLLIElement>, targetIndex: number) {
    const from = dragRef.current;
    if (!from || !onMove) return;
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = items.findIndex((item) => item.key === from);
    dragRef.current = "";
    setDragKey("");
    if (fromIndex >= 0 && fromIndex !== targetIndex) onMove(from, targetIndex - fromIndex);
  }

  return (
    <div className="upl-box" data-upload={rule.noun}>
      <div className="upl-head">
        <span className="upl-label" id={`${uid}-label`}>
          {label}
        </span>
        <InfoPopover id={popId} label={label}>
          <strong>{label}</strong>
          <ul>
            {rule.details.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </InfoPopover>
        <span className="upl-count" data-tk="upload-count">
          {counted} of {limit}
        </span>
      </div>
      <p className="upl-line" id={lineId}>
        {rule.line}
      </p>
      {hint ? <p className="upl-hint">{hint}</p> : null}
      <div
        className="upl-drop"
        data-over={over}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files") || off) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDropFiles}
      >
        <div className="upl-actions">
          <label className="upl-file" aria-disabled={off}>
            Choose files
            <input
              id={inputId}
              type="file"
              multiple
              accept={rule.accept.join(",")}
              disabled={off}
              aria-labelledby={`${uid}-label`}
              aria-describedby={`${lineId} ${popId}-pop`}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) onFiles(files);
              }}
            />
          </label>
          {onPickLibrary ? (
            <button type="button" className="upl-btn upl-btn-quiet" onClick={onPickLibrary} disabled={off}>
              Pick from Media library
            </button>
          ) : null}
        </div>
        <p className="upl-hint">Or drop files here.</p>
      </div>
      {note ? (
        <p className="upl-hint" role="status" data-tk="upload-note">
          {note}
        </p>
      ) : null}
      {items.length ? (
        <ul className="upl-grid" aria-label={`${label}, in order`}>
          {items.map((item, index) => {
            const refused = item.state === "failed";
            const cover = index === 0 && item.kind === "image" && !refused;
            return (
              <li
                key={item.key}
                className="upl-tile"
                draggable={Boolean(onMove) && !disabled && !refused && items.length > 1}
                data-state={item.state}
                data-dragging={dragKey === item.key}
                onDragStart={(event) => {
                  dragRef.current = item.key;
                  setDragKey(item.key);
                  event.dataTransfer.setData(DRAG_TYPE, item.key);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragRef.current = "";
                  setDragKey("");
                }}
                onDragOver={(event) => {
                  if (dragRef.current) event.preventDefault();
                }}
                onDrop={(event) => onDropTile(event, index)}
              >
                <div className="upl-thumb">
                  {item.kind === "image" && item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img src={item.previewUrl} alt="" />
                  ) : item.kind === "video" && item.previewUrl ? (
                    <video src={item.previewUrl} muted preload="metadata" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true">{item.kind === "video" ? "Video" : "Photo"}</span>
                  )}
                  {item.kind === "video" ? (
                    <span className="upl-play" aria-hidden="true">
                      &#9654;
                    </span>
                  ) : null}
                  {cover ? <span className="upl-cover">Cover</span> : null}
                </div>
                <span className="upl-name">{item.name}</span>
                {item.state === "uploading" ? (
                  <progress className="upl-progress" max={1} value={item.progress} aria-label={`Uploading ${item.name}`} />
                ) : null}
                {refused ? (
                  <span className="upl-error" role="alert">
                    {item.error}
                  </span>
                ) : (
                  <span className="upl-state">{item.state === "uploading" ? "Uploading..." : readyLine(item)}</span>
                )}
                <div className="upl-tile-actions" role="group" aria-label={`Actions for ${item.name}`}>
                  {refused || !onMove ? null : (
                    <>
                      <TileButton label={`Move ${item.name} earlier`} icon={ArrowLeft} disabled={index === 0} onClick={() => onMove(item.key, -1)} />
                      <TileButton label={`Move ${item.name} later`} icon={ArrowRight} disabled={index === last} onClick={() => onMove(item.key, 1)} />
                    </>
                  )}
                  {refused || !onCover ? null : (
                    <TileButton label={`Make ${item.name} the cover`} icon={Star} disabled={index === 0} onClick={() => onCover(item.key)} />
                  )}
                  <TileButton label={`Remove ${item.name}`} icon={Trash2} danger onClick={() => onRemove(item.key)} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
