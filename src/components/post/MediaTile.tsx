"use client";

import type { CSSProperties, PointerEventHandler } from "react";
import { useT } from "@/components/help/UiTextProvider";
import type { UiTextKey } from "@/lib/ui/text";
import { ArrowLeft, ArrowRight, CircleAlert, ImageOff, Star, Trash2, TriangleAlert, VideoOff } from "lucide-react";

export type TileState = "uploading" | "live" | "checking" | "refused" | "failed";

export interface MediaTileProps {
  kind: "image" | "video";
  label: string;
  state: TileState;
  /** The media id of a saved photo; the tile carries it so a test (and the drag code) can tell the tiles apart. */
  mediaId?: string;
  url?: string | null;
  posterUrl?: string | null;
  progress?: number;
  reason?: string | null;
  isCover?: boolean;
  busy?: boolean;
  /** H21.3: "lifted" is the tile under the finger while it is dragged; "slot" is the dashed place it will land in. */
  drag?: "" | "lifted" | "slot";
  dragStyle?: CSSProperties;
  /** Pointer handlers for the photo area (the drag starts there, never on a button). */
  frameHandlers?: { onPointerDown?: PointerEventHandler<HTMLDivElement>; onPointerMove?: PointerEventHandler<HTMLDivElement>; onPointerUp?: PointerEventHandler<HTMLDivElement>; onPointerCancel?: PointerEventHandler<HTMLDivElement> };
  onMakeCover?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
}

const STATE_KEY: Record<TileState, UiTextKey> = {
  uploading: "post.tile.uploading",
  live: "post.tile.live",
  checking: "post.tile.checking",
  refused: "post.tile.refused",
  failed: "post.tile.failed",
};

/** The photo: shown whole (never cropped) over a blurred copy of itself. A video shows its poster and plays. */
function Frame({ kind, url, posterUrl, label, failed }: Pick<MediaTileProps, "kind" | "url" | "posterUrl" | "label"> & { failed?: boolean }) {
  const t = useT();
  if (failed && !url) {
    const Icon = kind === "video" ? VideoOff : ImageOff;
    return (
      <div className="tkp-media-empty tkp-media-failed" data-tk="media-failed">
        <Icon size={28} aria-hidden="true" focusable="false" />
      </div>
    );
  }
  if (!url) return <div className="tkp-media-empty">{kind === "video" ? t("post.tile.videoEmpty") : t("post.tile.photoEmpty")}</div>;
  if (kind === "video") {
    return <video src={url} poster={posterUrl || undefined} controls muted playsInline preload="metadata" aria-label={label} />;
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tkph-blur" src={url} alt="" aria-hidden="true" loading="lazy" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tkph-fit" src={url} alt={label} loading="lazy" draggable={false} />
    </>
  );
}

/** One photo or video in the post-ad photo step: preview, status, upload share and the owner's actions. */
export function MediaTile(props: MediaTileProps) {
  const t = useT();
  const { kind, label, state, progress = 0, reason, isCover, busy, url, posterUrl, drag = "" } = props;
  const uploading = state === "uploading";
  const failed = state === "failed";
  const draggable = Boolean(props.frameHandlers) && !uploading && !failed;
  return (
    <li className={`tkp-media tkph-tile${drag ? ` is-${drag}` : ""}`} data-tk="photo-tile" data-state={state} data-kind={kind} data-id={props.mediaId} data-drag={drag || undefined} style={props.dragStyle}>
      <div className="tkp-media-frame tkph-img" data-draggable={draggable ? "yes" : undefined} {...(draggable ? props.frameHandlers : {})}>
        <Frame kind={kind} url={url} posterUrl={posterUrl} label={label} failed={failed} />
        {isCover ? <span className="tkp-media-cover tkph-cover" data-tk="photo-cover">{t("post.tile.cover")}</span> : null}
        {state !== "live" && !uploading && !failed ? <span className="tkp-media-state" data-tk="photo-state">{t(STATE_KEY[state])}</span> : null}
        {uploading ? (
          <div className="tkp-media-progress tkph-progress" data-tk="upload-progress" role="status">
            {t("post.tile.progress", { percent: Math.round(progress * 100) })}
            <div aria-hidden className="tkp-media-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </div>
        ) : null}
        {failed ? (
          <div className="tkph-failed" data-tk="upload-failed">
            <TriangleAlert size={26} aria-hidden="true" focusable="false" />
            <span>{t("post.v2.ph.failed")}</span>
            {props.onRetry ? (
              <button type="button" className="tkph-retry" data-tk="retry-upload" disabled={busy} onClick={props.onRetry}>{t("post.v2.ph.retry")}</button>
            ) : null}
          </div>
        ) : null}
        {drag === "lifted" ? <span className="tkph-moving">{t("post.v2.ph.moving")}</span> : null}
      </div>
      {reason ? (
        <p className="tkp-media-reason" data-tk="media-reason" role={failed ? "alert" : undefined}>
          <CircleAlert size={14} aria-hidden="true" focusable="false" />
          <span>{reason}</span>
        </p>
      ) : null}
      {!uploading && drag !== "slot" ? (
        <div className="tkp-media-actions tkph-actions">
          {props.onMakeCover && !isCover ? (
            <button type="button" className="tkp-mini tkp-mini-wide" data-tk="make-cover" aria-label={t("post.tile.makeCover")} title={t("post.tile.makeCover")} disabled={busy} onClick={props.onMakeCover}>
              <Star size={18} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.makeCover")}</span>
            </button>
          ) : null}
          {props.onMoveLeft ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={t("post.tile.moveLeft", { label })} title={t("post.tile.moveLeftShort")} onClick={props.onMoveLeft}>
              <ArrowLeft size={18} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.moveLeftShort")}</span>
            </button>
          ) : null}
          {props.onMoveRight ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={t("post.tile.moveRight", { label })} title={t("post.tile.moveRightShort")} onClick={props.onMoveRight}>
              <ArrowRight size={18} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.moveRightShort")}</span>
            </button>
          ) : null}
          {props.onRemove ? (
            <button type="button" className="tkp-mini tkph-bin" disabled={busy} aria-label={t("post.tile.remove", { label })} title={t("post.tile.removeShort")} onClick={props.onRemove}>
              <Trash2 size={18} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.removeShort")}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
