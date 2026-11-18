"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { api, friendlyError } from "@/lib/ui/api";
import { useT } from "@/components/help/UiTextProvider";
import type { DraftMedia } from "@/server/media/mine";
import type { PostCopy } from "./copy";
import { listDraftMediaAction, removeMyMediaAction } from "./mediaActions";
import { InfoPopover } from "@/components/upload/InfoPopover";
import { UPLOAD_RULES } from "@/components/upload/rules";
import { MediaTile } from "./MediaTile";
import { AD_MEDIA_MAX, checkPhoto, checkVideo, uploadMedia } from "./mediaUpload";

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
}: {
  listingId: string;
  copy: PostCopy;
  onBack?: () => void;
  onNext?: () => void;
  onMedia?: (media: DraftMedia) => void;
  onBusy?: (busy: boolean) => void;
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
    const entry: Upload = { key: newKey(), kind, previewUrl: kind === "image" ? URL.createObjectURL(file) : null, progress: 0, file, error, retry: false };
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

  return (
    <div className="tkp-photos">
      <div className="tkp-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) void addPhotos(Array.from(event.dataTransfer.files)); }}>
        <ImagePlus size={28} aria-hidden="true" focusable="false" />
        <p className="tkp-drop-line">{t("post.photo.dropLine")}</p>
        <div className="tkp-drop-buttons">
          <label className="tkp-btn tkp-btn-primary" aria-disabled={busy}>
            {t("post.photo.addPhotos")}
            <input
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
          </label>
        </div>
        <div className="tkp-drop-more" data-tk="photo-more">
          <label className="tkp-btn tkp-btn-small tkp-btn-camera" aria-disabled={busy}>
            <Camera size={18} aria-hidden="true" focusable="false" />
            {t("post.photo.takePhoto")}
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
          <label className="tkp-btn tkp-btn-small" aria-disabled={busy || atLimit}>
            {t("post.photo.addVideo")}
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
        </div>
        <p className="tkp-drop-rule" data-tk="photo-rule">
          {copy.photoRules.items[0] ?? t("post.photo.photoRuleFallback")}
          <InfoPopover id="post-rules" label={t("post.photo.rulesLabel")}>
            <strong>{t("post.photo.photoRulesTitle")}</strong>
            <ul>
              {UPLOAD_RULES.adPhotos.details.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
            <strong>{t("post.photo.videoRulesTitle")}</strong>
            <ul>
              {UPLOAD_RULES.postVideos.details.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </InfoPopover>
        </p>
      </div>
      <div className="tkp-count-row">
      <p className="tkp-count" data-tk="photo-count">{t("post.photo.count", { shown, limit })}</p>
      <p className="tkp-photo-note" data-tk="photo-note" role="status">{note}</p>
      </div>
      <ul className="tkp-media-grid" data-tk="photo-grid">
        {photos.map((photo, index) => (
          <MediaTile
            key={photo.id}
            kind="image"
            label={t("post.photo.photoN", { number: index + 1 })}
            state={photo.state}
            url={photo.url}
            reason={photo.reason}
            isCover={photo.id === draft?.coverId}
            busy={busy}
            onMakeCover={() => makeCover(index)}
            onMoveLeft={index > 0 ? () => moveBy(index, -1) : undefined}
            onMoveRight={index < photos.length - 1 ? () => moveBy(index, 1) : undefined}
            onRemove={() => void removeItem(photo.id)}
          />
        ))}
        {uploads.filter((upload) => upload.kind === "image").map((upload) => (
          <MediaTile
            key={upload.key}
            kind="image"
            label={t("post.photo.newPhoto")}
            state={upload.error ? "failed" : "uploading"}
            url={upload.previewUrl}
            progress={upload.progress}
            reason={upload.error}
            onRetry={upload.error && upload.retry ? () => void retryUpload(upload.key) : undefined}
            onRemove={upload.error ? () => dismissUpload(upload.key) : undefined}
          />
        ))}
      </ul>
      {videos.length || uploads.some((upload) => upload.kind === "video") ? (
        <ul className="tkp-media-grid" data-tk="video-grid">
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
              onRetry={upload.error && upload.retry ? () => void retryUpload(upload.key) : undefined}
              onRemove={upload.error ? () => dismissUpload(upload.key) : undefined}
            />
          ))}
        </ul>
      ) : null}
      {onBack && onNext ? (
        <div className="tkp-photo-nav">
          <button type="button" className="tkp-btn" onClick={onBack}>{steps.photos.backLabel || t("post.photo.back")}</button>
          <button type="button" className="tkp-btn tkp-btn-primary" data-tk="go-on" disabled={busy} onClick={onNext}>{steps.photos.nextLabel || t("post.photo.next")}</button>
        </div>
      ) : null}
    </div>
  );
}
