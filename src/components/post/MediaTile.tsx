"use client";

import { ArrowLeft, ArrowRight, RotateCw, Star, Trash2 } from "lucide-react";

export type TileState = "uploading" | "live" | "checking" | "refused" | "failed";

export interface MediaTileProps {
  kind: "image" | "video";
  label: string;
  state: TileState;
  url?: string | null;
  posterUrl?: string | null;
  progress?: number;
  reason?: string | null;
  isCover?: boolean;
  busy?: boolean;
  onMakeCover?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
}

const STATE_TEXT: Record<TileState, string> = { uploading: "Uploading", live: "Live", checking: "Being checked", refused: "Refused", failed: "Not saved" };

function Frame({ kind, url, posterUrl, label }: Pick<MediaTileProps, "kind" | "url" | "posterUrl" | "label">) {
  if (!url) return <div className="tkp-media-empty">{kind === "video" ? "Video" : "Photo"}</div>;
  if (kind === "video") {
    return <video src={url} poster={posterUrl || undefined} controls muted playsInline preload="metadata" aria-label={label} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={label} loading="lazy" />;
}

/** One photo or video in the post-ad photo step: preview, status, upload share and the owner's actions. */
export function MediaTile(props: MediaTileProps) {
  const { kind, label, state, progress = 0, reason, isCover, busy, url, posterUrl } = props;
  const uploading = state === "uploading";
  return (
    <li className="tkp-media" data-tk="photo-tile" data-state={state} data-kind={kind}>
      <div className="tkp-media-frame">
        {uploading && kind === "image" && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} style={{ opacity: 0.5 }} />
        ) : (
          <Frame kind={kind} url={url} posterUrl={posterUrl} label={label} />
        )}
        {isCover ? <span className="tkp-media-cover" data-tk="photo-cover">Cover</span> : null}
        {state !== "live" && !uploading ? <span className="tkp-media-state" data-tk="photo-state">{STATE_TEXT[state]}</span> : null}
        {uploading ? (
          <div className="tkp-media-progress" data-tk="upload-progress" role="status">
            Uploading {Math.round(progress * 100)}%
            <div aria-hidden className="tkp-media-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </div>
        ) : null}
      </div>
      {reason ? <p className="tkp-media-reason" data-tk="media-reason" role={state === "failed" ? "alert" : undefined}>{reason}</p> : null}
      {!uploading ? (
        <div className="tkp-media-actions">
          {props.onRetry ? (
            <button type="button" className="tkp-mini tkp-mini-wide" data-tk="retry-upload" disabled={busy} onClick={props.onRetry}>
              <RotateCw size={16} aria-hidden="true" focusable="false" />
              Tap to retry
            </button>
          ) : null}
          {props.onMakeCover && !isCover ? (
            <button type="button" className="tkp-mini tkp-mini-wide" disabled={busy} onClick={props.onMakeCover}>
              <Star size={16} aria-hidden="true" focusable="false" />
              Make cover
            </button>
          ) : null}
          {props.onMoveLeft ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={`Move ${label} left`} onClick={props.onMoveLeft}>
              <ArrowLeft size={18} aria-hidden="true" focusable="false" />
            </button>
          ) : null}
          {props.onMoveRight ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={`Move ${label} right`} onClick={props.onMoveRight}>
              <ArrowRight size={18} aria-hidden="true" focusable="false" />
            </button>
          ) : null}
          {props.onRemove ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={`Remove ${label}`} onClick={props.onRemove}>
              <Trash2 size={18} aria-hidden="true" focusable="false" />
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
