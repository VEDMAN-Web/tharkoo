"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import type { DraftMedia } from "@/server/media/mine";
import type { PostCopy } from "./copy";
import { listDraftMediaAction, removeMyMediaAction } from "./mediaActions";
import { UploadBox, type UploadItem } from "@/components/upload/UploadBox";
import { UPLOAD_RULES } from "@/components/upload/rules";
import { AD_MEDIA_MAX, checkPhoto, checkVideo, uploadMedia } from "./mediaUpload";

/** A file that is sending right now. It is counted until the server has it, then the saved row replaces it. */
type Upload = { key: string; kind: "image" | "video"; previewUrl: string | null; progress: number };
/** A file the browser or the server refused. It shows its reason and a Remove button, and it does not count. */
type Refused = { key: string; kind: "image" | "video"; name: string; error: string };

function newKey() {
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Post-ad step 3: photos and videos through the one shared upload box (H7.8). Each box shows its own size help,
 * the cover badge on the first photo, reorder, remove and the count against the ad's limit. Nothing is saved
 * until the file has reached the server; refused files stay on screen with their reason only.
 */
export function PhotoStep({ listingId, copy, onBack, onNext, newDesign = false }: { listingId: string; copy: PostCopy; onBack: () => void; onNext: () => void; newDesign?: boolean }) {
  const [draft, setDraft] = useState<DraftMedia | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [refused, setRefused] = useState<Refused[]>([]);
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
    }
  }, [listingId]);

  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const photos = draft?.photos ?? [];
  const videos = draft?.videos ?? [];
  // H6.18: one limit for photos and videos together. Uploads still in progress count too.
  const limit = draft?.limit ?? AD_MEDIA_MAX;
  const shown = photos.length + videos.length;
  const busy = uploads.length > 0 || busyId !== "";
  const photoLimit = Math.max(0, limit - videos.length);
  const videoLimit = Math.max(0, limit - photos.length);

  function patchUpload(key: string, progress: number) {
    setUploads((prev) => prev.map((upload) => (upload.key === key ? { ...upload, progress } : upload)));
  }

  function finishUpload(upload: Upload) {
    if (upload.previewUrl) URL.revokeObjectURL(upload.previewUrl);
    setUploads((prev) => prev.filter((item) => item.key !== upload.key));
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

  async function sendOne(file: File, kind: "image" | "video"): Promise<string | null> {
    const entry: Upload = { key: newKey(), kind, previewUrl: kind === "image" ? URL.createObjectURL(file) : null, progress: 0 };
    setUploads((prev) => [...prev, entry]);
    const result = await uploadMedia({ listingId, file, kind, onProgress: (ratio) => patchUpload(entry.key, ratio) });
    let error = result.ok ? null : result.error;
    if (result.ok && kind === "image") error = await attachPhoto(result.mediaId);
    await refresh();
    finishUpload(entry);
    return error;
  }

  function refuse(kind: "image" | "video", file: File, error: string) {
    setRefused((prev) => [...prev, { key: newKey(), kind, name: file.name, error }]);
  }

  async function addPhotos(files: File[]) {
    if (!listingId) return setNote("Save the ad details before adding a photo.");
    let room = limit - shown - uploads.length;
    if (room <= 0) return setNote(`Your ad allows ${limit} photos and videos in total. Remove one to add another.`);
    let saved = 0;
    for (const file of files) {
      if (room <= 0) {
        setNote(`Only ${saved} more fit within your limit of ${limit} photos and videos.`);
        break;
      }
      const rule = checkPhoto(file);
      const error = rule ?? (await sendOne(file, "image"));
      if (error) refuse("image", file, error);
      else {
        saved += 1;
        room -= 1;
      }
    }
    if (saved) setNote(saved === 1 ? "Photo saved." : `${saved} photos saved.`);
  }

  async function addVideos(files: File[]) {
    if (!listingId) return setNote("Save the ad details before adding a video.");
    if (shown + uploads.length >= limit) return setNote(`Your ad allows ${limit} photos and videos in total. Remove one first.`);
    for (const file of files) {
      const rule = await checkVideo(file);
      if (rule) refuse("video", file, rule);
      else {
        const error = await sendOne(file, "video");
        if (error) refuse("video", file, error);
        else setNote("Video saved.");
      }
    }
  }

  async function removeItem(id: string) {
    setBusyId(id);
    const res = await removeMyMediaAction(id);
    if (res.ok) await refresh();
    setBusyId("");
    setNote(res.ok ? "Removed." : res.error);
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

  function removeKey(key: string) {
    if (refused.some((item) => item.key === key)) return setRefused((prev) => prev.filter((item) => item.key !== key));
    if (photos.some((photo) => photo.id === key) || videos.some((video) => video.id === key)) void removeItem(key);
  }

  const photoItems: UploadItem[] = [
    ...photos.map((photo, index) => ({
      key: photo.id,
      name: `Photo ${index + 1}`,
      kind: "image" as const,
      previewUrl: photo.url ?? undefined,
      state: photo.state === "refused" ? ("failed" as const) : photo.state === "checking" ? ("uploading" as const) : ("ready" as const),
      size: photo.bytes ?? undefined,
      error: photo.reason ?? undefined,
    })),
    ...uploads.filter((upload) => upload.kind === "image").map((upload) => ({
      key: upload.key,
      name: "New photo",
      kind: "image" as const,
      previewUrl: upload.previewUrl ?? undefined,
      state: "uploading" as const,
      progress: upload.progress,
    })),
    ...refused.filter((item) => item.kind === "image").map((item) => ({ key: item.key, name: item.name, kind: "image" as const, state: "failed" as const, error: item.error })),
  ];

  const videoItems: UploadItem[] = [
    ...videos.map((video, index) => ({
      key: video.id,
      name: `Video ${index + 1}`,
      kind: "video" as const,
      previewUrl: video.posterUrl ?? undefined,
      state: video.state === "refused" ? ("failed" as const) : video.state === "checking" ? ("uploading" as const) : ("ready" as const),
      error: video.reason ?? undefined,
    })),
    ...uploads.filter((upload) => upload.kind === "video").map((upload) => ({
      key: upload.key,
      name: "New video",
      kind: "video" as const,
      state: "uploading" as const,
      progress: upload.progress,
    })),
    ...refused.filter((item) => item.kind === "video").map((item) => ({ key: item.key, name: item.name, kind: "video" as const, state: "failed" as const, error: item.error })),
  ];

  return (
    <>
      <div className="tk-form-panel tkp-media">
        <p className="t-small" data-tk="photo-count">{shown} of {limit} photos and videos</p>
        {note ? <p data-tk="photo-note" role="status">{note}</p> : steps.photos.help ? <p className="t-small">{steps.photos.help}</p> : null}
        <section aria-label="Photos" data-tk="photo-box">
          <UploadBox
            label="Photos"
            rule={UPLOAD_RULES.adPhotos}
            items={photoItems}
            limit={photoLimit}
            disabled={busy}
            onFiles={(files) => void addPhotos(files)}
            onRemove={removeKey}
            onMove={(key, step) => {
              const index = photos.findIndex((photo) => photo.id === key);
              if (index >= 0) moveBy(index, step);
            }}
            onCover={(key) => {
              const index = photos.findIndex((photo) => photo.id === key);
              if (index >= 0) makeCover(index);
            }}
          />
        </section>
        <section aria-label="Videos" data-tk="video-box" style={{ marginTop: 16 }}>
          <UploadBox
            label="Videos"
            rule={UPLOAD_RULES.adVideos}
            items={videoItems}
            limit={videoLimit}
            disabled={busy}
            onFiles={(files) => void addVideos(files)}
            onRemove={removeKey}
          />
        </section>
      </div>
      {newDesign ? null : (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button type="button" className="tk-btn tk-btn-outline-gold" onClick={onBack}>{steps.photos.backLabel}</button>
          <button type="button" className="tk-btn tk-btn-gold" data-tk="go-on" disabled={busy} onClick={onNext}>{steps.photos.nextLabel}</button>
        </div>
      )}
    </>
  );
}
