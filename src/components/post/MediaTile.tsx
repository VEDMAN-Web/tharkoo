"use client";

import { useT } from "@/components/help/UiTextProvider";
import type { UiTextKey } from "@/lib/ui/text";
import { ArrowLeft, ArrowRight, CircleAlert, ImageOff, RotateCw, Star, Trash2, VideoOff } from "lucide-react";

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

const STATE_KEY: Record<TileState, UiTextKey> = {
  uploading: "post.tile.uploading",
  live: "post.tile.live",
  checking: "post.tile.checking",
  refused: "post.tile.refused",
  failed: "post.tile.failed",
};

function Frame({ kind, url, posterUrl, label, failed }: Pick<MediaTileProps, "kind" | "url" | "posterUrl" | "label"> & { failed?: boolean }) {
  const t = useT();
  if (failed) {
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={label} loading="lazy" />;
}

/** One photo or video in the post-ad photo step: preview, status, upload share and the owner's actions. */
export function MediaTile(props: MediaTileProps) {
  const t = useT();
  const { kind, label, state, progress = 0, reason, isCover, busy, url, posterUrl } = props;
  const uploading = state === "uploading";
  return (
    <li className="tkp-media" data-tk="photo-tile" data-state={state} data-kind={kind}>
      <div className="tkp-media-frame">
        {uploading && kind === "image" && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} style={{ opacity: 0.5 }} />
        ) : (
          <Frame kind={kind} url={url} posterUrl={posterUrl} label={label} failed={state === "failed"} />
        )}
        {isCover ? <span className="tkp-media-cover" data-tk="photo-cover">{t("post.tile.cover")}</span> : null}
        {state !== "live" && !uploading ? <span className="tkp-media-state" data-tk="photo-state">{t(STATE_KEY[state])}</span> : null}
        {uploading ? (
          <div className="tkp-media-progress" data-tk="upload-progress" role="status">
            {t("post.tile.progress", { percent: Math.round(progress * 100) })}
            <div aria-hidden className="tkp-media-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </div>
        ) : null}
      </div>
      {reason ? (
        <p className="tkp-media-reason" data-tk="media-reason" role={state === "failed" ? "alert" : undefined}>
          <CircleAlert size={14} aria-hidden="true" focusable="false" />
          <span>{reason}</span>
        </p>
      ) : null}
      {!uploading ? (
        <div className="tkp-media-actions">
          {props.onRetry ? (
            <button type="button" className="tkp-mini tkp-mini-wide" data-tk="retry-upload" disabled={busy} onClick={props.onRetry}>
              <RotateCw size={16} aria-hidden="true" focusable="false" />
              {t("post.tile.retry")}
            </button>
          ) : null}
          {props.onMakeCover && !isCover ? (
            <button type="button" className="tkp-mini tkp-mini-wide" data-tk="make-cover" aria-label={t("post.tile.makeCover")} disabled={busy} onClick={props.onMakeCover}>
              <Star size={16} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.makeCover")}</span>
            </button>
          ) : null}
          {props.onMoveLeft ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={t("post.tile.moveLeft", { label })} onClick={props.onMoveLeft}>
              <ArrowLeft size={16} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.moveLeftShort")}</span>
            </button>
          ) : null}
          {props.onMoveRight ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={t("post.tile.moveRight", { label })} onClick={props.onMoveRight}>
              <ArrowRight size={16} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.moveRightShort")}</span>
            </button>
          ) : null}
          {props.onRemove ? (
            <button type="button" className="tkp-mini" disabled={busy} aria-label={t("post.tile.remove", { label })} onClick={props.onRemove}>
              <Trash2 size={16} aria-hidden="true" focusable="false" />
              <span className="tkp-mini-text">{t("post.tile.removeShort")}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
