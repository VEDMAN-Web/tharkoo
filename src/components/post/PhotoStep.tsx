"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import type { DraftMedia } from "@/server/media/mine";
import type { PostCopy } from "./copy";
import { listDraftMediaAction, removeMyMediaAction } from "./mediaActions";
import { InfoPopover } from "@/components/upload/InfoPopover";
import { UPLOAD_RULES } from "@/components/upload/rules";
import { MediaTile } from "./MediaTile";
import { AD_MEDIA_MAX, checkPhoto, checkVideo, uploadMedia } from "./mediaUpload";

const VIDEO_RULE_LINE = "Videos: max 10 MB and 30 seconds each. Photos and videos: up to 10 in total.";
const GRID = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16, padding: 0, margin: 0 } as const;

type Upload = { key: string; kind: "image" | "video"; previewUrl: string | null; progress: number };

function newKey() {
  return `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Post-ad step 2: several photos at once, a thumbnail grid with upload progress, remove, make cover and reorder,
 * with "N of M photos" against the ad's limit. Videos get a preview frame, play and remove.
 */
export function PhotoStep({ listingId, copy, onBack, onNext }: { listingId: string; copy: PostCopy; onBack: () => void; onNext: () => void }) {
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
  const atLimit = shown + uploads.length >= limit;
  const busy = uploads.length > 0 || busyId !== "";

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

  async function addPhotos(files: File[]) {
    if (!listingId) return setNote("Save the ad details before adding a photo.");
    const room = limit - shown - uploads.length;
    if (room <= 0) return setNote(`Your ad allows ${limit} photos and videos in total. Remove one to add another.`);
    let problem = files.length > room ? `Only ${room} more ${room === 1 ? "item fits" : "items fit"} within your limit of ${limit} photos and videos.` : "";
    let saved = 0;
    for (const file of files.slice(0, room)) {
      const rule = checkPhoto(file);
      const error = rule ?? (await sendOne(file, "image"));
      if (error) problem = error;
      else saved += 1;
    }
    const done = saved === 1 ? "Photo saved." : saved > 1 ? `${saved} photos saved.` : "";
    setNote([done, problem].filter(Boolean).join(" "));
  }

  async function addVideo(file: File) {
    if (!listingId) return setNote("Save the ad details before adding a video.");
    if (atLimit) return setNote(`Your ad allows ${limit} photos and videos in total. Remove one first.`);
    const rule = await checkVideo(file);
    if (rule) return setNote(rule);
    const error = await sendOne(file, "video");
    setNote(error ?? "Video saved.");
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

  return (
    <>
      <div className="tk-form-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="t-h3">Your photos</h2>
          <InfoPopover id="post-photos" label="Your photos">
            <strong>Your photos</strong>
            <ul>
              {UPLOAD_RULES.adPhotos.details.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </InfoPopover>
        </div>
        <div
          className="tk-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!busy) void addPhotos(Array.from(event.dataTransfer.files));
          }}
        >
          <p>Drag photos here or</p>
          <label className="tk-btn tk-btn-outline-primary" aria-disabled={busy}>
            ADD PHOTOS
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
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
          {copy.photoRules.title ? <p className="t-small" style={{ fontWeight: 600 }}>{copy.photoRules.title}</p> : null}
          {copy.photoRules.items.map((rule) => (
            <p key={rule} className="t-small">{rule}</p>
          ))}
        </div>
        <p className="t-small" data-tk="photo-count">{shown} of {limit} photos and videos</p>
        {note ? <p data-tk="photo-note" role="status">{note}</p> : steps.photos.help ? <p className="t-small">{steps.photos.help}</p> : null}
        <ul data-tk="photo-grid" style={GRID}>
          {photos.map((photo, index) => (
            <MediaTile
              key={photo.id}
              kind="image"
              label={`Photo ${index + 1}`}
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
            <MediaTile key={upload.key} kind="image" label="New photo" state="uploading" url={upload.previewUrl} progress={upload.progress} />
          ))}
        </ul>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <h3 className="t-h3">Your videos</h3>
          <InfoPopover id="post-videos" label="Your videos">
            <strong>Your videos</strong>
            <ul>
              {UPLOAD_RULES.adVideos.details.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </InfoPopover>
        </div>
        <label className="tk-btn tk-btn-outline-primary" aria-disabled={busy || atLimit}>
          ADD VIDEO
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
        <p className="t-small">{VIDEO_RULE_LINE}</p>
        {videos.length || uploads.some((upload) => upload.kind === "video") ? (
          <ul data-tk="video-grid" style={GRID}>
            {videos.map((video, index) => (
              <MediaTile
                key={video.id}
                kind="video"
                label={`Video ${index + 1}`}
                state={video.state}
                url={video.url}
                posterUrl={video.posterUrl}
                reason={video.reason}
                busy={busy}
                onRemove={() => void removeItem(video.id)}
              />
            ))}
            {uploads.filter((upload) => upload.kind === "video").map((upload) => (
              <MediaTile key={upload.key} kind="video" label="New video" state="uploading" progress={upload.progress} />
            ))}
          </ul>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button type="button" className="tk-btn tk-btn-outline-primary" onClick={onBack}>{steps.photos.backLabel}</button>
        <button type="button" className="tk-btn tk-btn-cta" data-tk="go-on" disabled={busy} onClick={onNext}>{steps.photos.nextLabel}</button>
      </div>
    </>
  );
}
