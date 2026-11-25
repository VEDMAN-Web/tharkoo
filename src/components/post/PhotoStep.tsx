"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Camera, ImagePlus, Info, Plus, Video } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { useT } from "@/components/help/UiTextProvider";
import type { DraftMedia } from "@/server/media/mine";
import type { PostCopy } from "./copy";
import { listDraftMediaAction, removeMyMediaAction } from "./mediaActions";
import { MediaTile } from "./MediaTile";
import { PhotoGuidelines } from "./PhotoGuidelines";
import { DRAG_START_PX, indexAt, LONG_PRESS_MS, moveItem, PRESS_SLOP_PX } from "./photo-order";
import "./photos-step.css";
import { AD_MEDIA_MAX, checkPhoto, checkVideo, PHOTO_TYPES, uploadMedia } from "./mediaUpload";

type Upload = { key: string; kind: "image" | "video"; previewUrl: string | null; progress: number; file: File; error?: string; retry?: boolean };

function newKey() {
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Post-ad step 2: several photos at once, a thumbnail grid with upload progress, remove, make cover and reorder,
 * with "N of M photos" against the ad's limit. Videos get a preview frame, play and remove.
 */
export function PhotoStep({
  listingId,
  copy,
  onBack,
  onNext,
  onMedia,
  onBusy,
  allowVideo = true,
}: {
  listingId: string;
  copy: PostCopy;
  onBack?: () => void;
  onNext?: () => void;
  onMedia?: (media: DraftMedia) => void;
  onBusy?: (busy: boolean) => void;
  /** FIX-1: false for a listing about people, which never holds a video. */
  allowVideo?: boolean;
}) {
  const t = useT();
  const [draft, setDraft] = useState<DraftMedia | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  // Uploads and order changes run one at a time, so each one reads the list the last one saved.
  const draftRef = useRef<DraftMedia | null>(null);
  const { steps } = copy;

  const refresh = useCallback(async () => {
    if (!listingId) return;
    const next = await listDraftMediaAction(listingId);
    if (next) {
      draftRef.current = next;
      setDraft(next);
      onMedia?.(next);
    }
  }, [listingId, onMedia]);

  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const photos = draft?.photos ?? [];
  const videos = draft?.videos ?? [];
  // H6.18: one limit for photos and videos together. Uploads still in progress count too.
  const limit = draft?.limit ?? AD_MEDIA_MAX;
  const shown = photos.length + videos.length;
  const sending = uploads.filter((upload) => !upload.error).length;
  const atLimit = shown + sending >= limit;
  const busy = sending > 0 || busyId !== "";

  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);

  // H21.3: dragging a photo to a new place. A mouse drags after a few pixels; a finger after a quarter of a second held still.
  type Drag = { id: string; from: number; to: number; x: number; y: number; offX: number; offY: number; width: number };
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<{ id: string; pointerId: number; touch: boolean; x: number; y: number; timer: number | null } | null>(null);
  const gridRef = useRef<HTMLUListElement | null>(null);

  function setDragState(next: Drag | null) {
    dragRef.current = next;
    setDrag(next);
  }

  // While a photo is lifted a finger must not scroll the page.
  useEffect(() => {
    if (!drag) return;
    const stop = (event: TouchEvent) => event.preventDefault();
    window.addEventListener("touchmove", stop, { passive: false });
    return () => window.removeEventListener("touchmove", stop);
  }, [drag === null]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearPress() {
    if (press.current?.timer) window.clearTimeout(press.current.timer);
    press.current = null;
  }

  function beginDrag(id: string, clientX: number, clientY: number, target: HTMLElement | null, pointerId: number) {
    const tile = target?.closest<HTMLElement>("li");
    const from = photos.findIndex((photo) => photo.id === id);
    if (!tile || from < 0) return;
    const rect = tile.getBoundingClientRect();
    try {
      target?.setPointerCapture(pointerId);
    } catch {
      // A pointer that is already gone cannot be captured; the drag simply ends on the next event.
    }
    setDragState({ id, from, to: from, x: clientX, y: clientY, offX: clientX - rect.left, offY: clientY - rect.top, width: rect.width });
  }

  function handlersFor(id: string) {
    return {
      onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (busy || dragRef.current || (event.pointerType === "mouse" && event.button !== 0)) return;
        const touch = event.pointerType !== "mouse";
        const target = event.currentTarget;
        const { clientX, clientY, pointerId } = event;
        clearPress();
        const timer = touch ? window.setTimeout(() => { beginDrag(id, clientX, clientY, target, pointerId); if (press.current) press.current.timer = null; }, LONG_PRESS_MS) : null;
        press.current = { id, pointerId, touch, x: clientX, y: clientY, timer };
      },
      onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
        const current = dragRef.current;
        if (current) {
          const boxes = Array.from(gridRef.current?.querySelectorAll<HTMLElement>('li[data-kind="image"]:not([data-drag="lifted"])') ?? [])
            .filter((el) => el.dataset.drag === "slot" || el.dataset.id)
            .map((el) => el.getBoundingClientRect());
          const to = indexAt(boxes, event.clientX, event.clientY);
          setDragState({ ...current, x: event.clientX, y: event.clientY, to: to < 0 ? current.to : to });
          return;
        }
        const waiting = press.current;
        if (!waiting || waiting.id !== id) return;
        const moved = Math.hypot(event.clientX - waiting.x, event.clientY - waiting.y);
        if (waiting.touch) {
          // A finger that moves before the press is long enough is scrolling the page.
          if (moved > PRESS_SLOP_PX) clearPress();
        } else if (moved > DRAG_START_PX) {
          clearPress();
          beginDrag(id, event.clientX, event.clientY, event.currentTarget, event.pointerId);
        }
      },
      onPointerUp: () => finishDrag(),
      onPointerCancel: () => finishDrag(true),
    };
  }

  function finishDrag(cancelled = false) {
    clearPress();
    const current = dragRef.current;
    if (!current) return;
    setDragState(null);
    if (cancelled || current.to === current.from) return;
    // The photo that lands first becomes the cover.
    const ids = moveItem(photos.map((photo) => photo.id), current.from, current.to);
    void reorder(ids, ids[0] ?? null);
  }

  function patchUpload(key: string, progress: number) {
    setUploads((prev) => prev.map((upload) => (upload.key === key ? { ...upload, progress } : upload)));
  }

  function finishUpload(upload: Upload) {
    if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
    setUploads((prev) => prev.filter((item) => item.key !== upload.key));
  }

  function failUpload(key: string, error: string, retry: boolean) {
    setUploads((prev) => prev.map((upload) => (upload.key === key ? { ...upload, error, retry, progress: 0 } : upload)));
  }

  function addFailedTile(file: File, kind: "image" | "video", error: string) {
    // A file that is not a photo has nothing to preview: the tile shows a neutral placeholder, never a broken image.
    const entry: Upload = { key: newKey(), kind, previewUrl: kind === "image" && PHOTO_TYPES.includes(file.type) ? URL.createObjectURL(file) : null, progress: 0, file, error, retry: false };
    setUploads((prev) => [...prev, entry]);
  }

  /** Saves the photo order and cover. Returns a message to show, or null on success. */
  async function saveOrder(ids: string[], cover: string | null): Promise<string | null> {
    const res = await api(`/api/listings/${listingId}`, {
      method: "PATCH",
      body: JSON.stringify({ stage: "photos", mediaIds: ids, coverMediaId: cover ?? ids[0] }),
    });
    return res.ok ? null : friendlyError(res.error);
  }

  async function attachPhoto(mediaId: string): Promise<string | null> {
    const current = draftRef.current;
    const ids = [...(current?.photos.map((photo) => photo.id) ?? []), mediaId];
    const cover = current?.coverId && ids.includes(current.coverId) ? current.coverId : mediaId;
    return saveOrder(ids, cover);
  }

  async function runUpload(entry: Upload): Promise<string | null> {
    setUploads((prev) => prev.map((upload) => (upload.key === entry.key ? { ...upload, error: undefined, retry: false, progress: 0 } : upload)));
    const result = await uploadMedia({ listingId, file: entry.file, kind: entry.kind, onProgress: (ratio) => patchUpload(entry.key, ratio) });
    let error = result.ok ? null : result.error;
    let retry = !result.ok && Boolean(result.retry);
    if (result.ok && entry.kind === "image") {
      error = await attachPhoto(result.mediaId);
      retry = false;
    }
    await refresh();
    if (error) failUpload(entry.key, error, retry);
    else finishUpload(entry);
    return error;
  }

  async function sendOne(file: File, kind: "image" | "video"): Promise<string | null> {
    const entry: Upload = { key: newKey(), kind, previewUrl: kind === "image" ? URL.createObjectURL(file) : null, progress: 0, file };
    setUploads((prev) => [...prev, entry]);
    return runUpload(entry);
  }

  async function retryUpload(key: string) {
    const entry = uploads.find((upload) => upload.key === key);
    if (!entry) return;
    const error = await runUpload(entry);
    setNote(error ?? (entry.kind === "video" ? t("post.photo.videoSaved") : t("post.photo.photoSaved")));
  }

  function dismissUpload(key: string) {
    const entry = uploads.find((upload) => upload.key === key);
    if (entry) finishUpload(entry);
  }

  async function addPhotos(files: File[]) {
    if (!listingId) return setNote(t("post.photo.saveFirstPhoto"));
    const room = limit - shown - sending;
    if (room <= 0) return setNote(t("post.photo.limitFull", { limit }));
    let problem = files.length > room ? t(room === 1 ? "post.photo.roomOne" : "post.photo.roomMany", { room, limit }) : "";
    let saved = 0;
    for (const file of files.slice(0, room)) {
      const rule = checkPhoto(file);
      if (rule) addFailedTile(file, "image", rule);
      const error = rule ?? (await sendOne(file, "image"));
      if (error) problem = error;
      else saved += 1;
    }
    const done = saved === 1 ? t("post.photo.photoSaved") : saved > 1 ? t("post.photo.photosSaved", { count: saved }) : "";
    setNote([done, problem].filter(Boolean).join(" "));
  }

  async function addVideo(file: File) {
    if (!listingId) return setNote(t("post.photo.saveFirstVideo"));
    if (atLimit) return setNote(t("post.photo.limitFullVideo", { limit }));
    const rule = await checkVideo(file);
    if (rule) {
      addFailedTile(file, "video", rule);
      return setNote(rule);
    }
    const error = await sendOne(file, "video");
    setNote(error ?? t("post.photo.videoSaved"));
  }

  async function removeItem(id: string) {
    setBusyId(id);
    const res = await removeMyMediaAction(id);
    if (res.ok) await refresh();
    setBusyId("");
    setNote(res.ok ? t("post.photo.removed") : res.error);
  }

  async function reorder(ids: string[], cover: string | null) {
    setBusyId("order");
    const error = await saveOrder(ids, cover);
    await refresh();
    setBusyId("");
    setNote(error ?? "");
  }

  function moveBy(index: number, delta: number) {
    const ids = photos.map((photo) => photo.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    void reorder(next, draft?.coverId ?? null);
  }

  function makeCover(index: number) {
    const id = photos[index].id;
    void reorder([id, ...photos.map((photo) => photo.id).filter((other) => other !== id)], id);
  }

  const empty = photos.length === 0 && videos.length === 0 && uploads.length === 0;
  const fileInputId = "photo-file-input";

  /** The photos in grid order: the lifted one keeps its place in the list (it only floats), and a dashed slot shows where it will land. */
  function photoTiles(): ReactNode[] {
    const out: ReactNode[] = [];
    let seen = 0;
    const slot = <li key="slot" className="tkp-media tkph-tile is-slot" data-kind="image" data-drag="slot" data-tk="photo-slot" aria-hidden="true"><div className="tkph-img" /></li>;
    photos.forEach((photo, index) => {
      const lifted = drag?.id === photo.id;
      if (drag && !lifted) {
        if (seen === drag.to) out.push(slot);
        seen += 1;
      }
      out.push(
        <MediaTile
          key={photo.id}
          kind="image"
          mediaId={photo.id}
          label={t("post.photo.photoN", { number: index + 1 })}
          state={photo.state}
          url={photo.url}
          reason={photo.reason}
          isCover={!drag && photo.id === draft?.coverId}
          busy={busy}
          drag={lifted ? "lifted" : ""}
          dragStyle={lifted ? { position: "fixed", left: drag.x - drag.offX, top: drag.y - drag.offY, width: drag.width, zIndex: 60, pointerEvents: "none" } : undefined}
          frameHandlers={handlersFor(photo.id)}
          onMakeCover={() => makeCover(index)}
          onMoveLeft={index > 0 ? () => moveBy(index, -1) : undefined}
          onMoveRight={index < photos.length - 1 ? () => moveBy(index, 1) : undefined}
          onRemove={() => void removeItem(photo.id)}
        />,
      );
    });
    if (drag && seen === drag.to) out.push(slot);
    return out;
  }

  function cameraButton() {
    return (
      <label className="tkph-btn" aria-disabled={busy}>
        <Camera size={18} aria-hidden="true" focusable="false" />
        {t("post.v2.ph.take")}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          data-tk="camera-input"
          hidden
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void addPhotos(files);
          }}
        />
      </label>
    );
  }

  function videoButton() {
    if (!allowVideo) return null;
    return (
      <label className="tkph-btn" aria-disabled={busy || atLimit}>
        <Video size={18} aria-hidden="true" focusable="false" />
        {t("post.v2.ph.video")}
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          data-tk="video-input"
          hidden
          disabled={busy || atLimit}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void addVideo(file);
          }}
        />
      </label>
    );
  }

  return (
    <div className="tkp-photos tkph" data-tk="photo-step" data-empty={empty ? "yes" : "no"} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) void addPhotos(Array.from(event.dataTransfer.files)); }}>
      {/* One file box serves "Choose photos" and "Add more". */}
      <input
        id={fileInputId}
        type="file"
        multiple
        accept="image/*"
        data-tk="photo-input"
        hidden
        disabled={busy}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void addPhotos(files);
        }}
      />
      {empty ? (
        <>
        <div className="tkph-drop" data-tk="photo-drop">
          <ImagePlus size={44} aria-hidden="true" focusable="false" />
          <p className="tkph-drop-title">{t("post.v2.ph.dropTitle")}</p>
          <p className="tkph-hint">{t("post.v2.ph.dropHint")}</p>
          <div className="tkph-buttons">
            <label htmlFor={fileInputId} className="tkph-btn primary" aria-disabled={busy}>
              <ImagePlus size={18} aria-hidden="true" focusable="false" />
              {t("post.v2.ph.choose")}
            </label>
            {cameraButton()}
            {videoButton()}
          </div>
          {allowVideo ? null : <p className="tkph-hint" data-tk="no-video">{t("post.photo.noVideo")}</p>}
        </div>
        <p className="tkph-tip" data-tk="photo-tip"><Info size={18} aria-hidden="true" focusable="false" /><span>{t("post.v2.ph.tip")}</span></p>
        </>
      ) : (
        <>
          <div className="tkph-head">
            <span className="tkph-count" data-tk="photo-count">{t("post.v2.ph.added", { shown, limit })}</span>
            {photos.length > 1 ? <span className="tkph-hint">{t("post.v2.ph.dragHint")}</span> : null}
          </div>
          <ul className="tkp-media-grid tkph-grid" data-tk="photo-grid" ref={gridRef}>
            {photoTiles()}
            {uploads.filter((upload) => upload.kind === "image").map((upload) => (
              <MediaTile
                key={upload.key}
                kind="image"
                label={t("post.photo.newPhoto")}
                state={upload.error ? "failed" : "uploading"}
                url={upload.previewUrl}
                progress={upload.progress}
                reason={upload.error}
                busy={busy}
                onRetry={upload.error && upload.retry ? () => void retryUpload(upload.key) : undefined}
                onRemove={upload.error ? () => dismissUpload(upload.key) : undefined}
              />
            ))}
            {!atLimit ? (
              <li className="tkph-add-li">
                <label htmlFor={fileInputId} className="tkph-add" data-tk="photo-add-more" aria-disabled={busy}>
                  <Plus size={22} aria-hidden="true" focusable="false" />
                  {t("post.v2.ph.addMore")}
                </label>
              </li>
            ) : null}
          </ul>
          <div className="tkph-buttons small">
            {cameraButton()}
            {videoButton()}
          </div>
        </>
      )}
      <p className="tkph-note" data-tk="photo-note" role="status">{note}</p>
      {videos.length || uploads.some((upload) => upload.kind === "video") ? (
        <ul className="tkp-media-grid tkph-grid" data-tk="video-grid">
          {videos.map((video, index) => (
            <MediaTile
              key={video.id}
              kind="video"
              label={t("post.photo.videoN", { number: index + 1 })}
              state={video.state}
              url={video.url}
              posterUrl={video.posterUrl}
              reason={video.reason}
              busy={busy}
              onRemove={() => void removeItem(video.id)}
            />
          ))}
          {uploads.filter((upload) => upload.kind === "video").map((upload) => (
            <MediaTile
              key={upload.key}
              kind="video"
              label={t("post.photo.newVideo")}
              state={upload.error ? "failed" : "uploading"}
              progress={upload.progress}
              reason={upload.error}
              busy={busy}
              onRetry={upload.error && upload.retry ? () => void retryUpload(upload.key) : undefined}
              onRemove={upload.error ? () => dismissUpload(upload.key) : undefined}
            />
          ))}
        </ul>
      ) : null}
      <PhotoGuidelines where="inline" limit={limit} />
      {onBack && onNext ? (
        <div className="tkp-photo-nav">
          <button type="button" className="tkp-btn" onClick={onBack}>{steps.photos.backLabel || t("post.photo.back")}</button>
          <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy} onClick={onNext}>{steps.photos.nextLabel || t("post.photo.next")}</button>
        </div>
      ) : null}
    </div>
  );
}
