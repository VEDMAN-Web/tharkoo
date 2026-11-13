"use client";

import { useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/ui/api";
import { listMyVideosAction, removeMyVideoAction } from "./videoActions";

export const VIDEO_RULE_LINE = "Videos: up to 2, max 10 MB and 30 seconds each.";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SECONDS = 30;
const MAX_VIDEOS = 2;
const TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const RULE_NOTE = "Use an mp4, webm or mov video up to 10 MB and 30 seconds.";

type Signed = {
  uploadUrl: string;
  mediaId: string;
  apiKey?: string;
  timestamp?: number;
  signature?: string;
  folder?: string;
  params?: Record<string, string | number>;
};

/** Reads the clip length in the browser before anything is uploaded. */
function clipSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : Number.NaN);
    video.onerror = () => done(Number.NaN);
    video.src = url;
  });
}

async function sendFile(signed: Signed, file: File): Promise<boolean> {
  const body = new FormData();
  body.set("file", file);
  if (signed.uploadUrl.startsWith("/")) {
    body.set("mediaId", signed.mediaId);
    return (await fetch(signed.uploadUrl, { method: "POST", body, credentials: "same-origin" })).ok;
  }
  body.set("api_key", signed.apiKey || "");
  body.set("timestamp", String(signed.timestamp || ""));
  body.set("signature", signed.signature || "");
  body.set("folder", signed.folder || "");
  for (const [key, value] of Object.entries(signed.params || {})) body.set(key, String(value));
  if (!(await fetch(signed.uploadUrl, { method: "POST", body })).ok) return false;
  return (await api("/api/media/complete", { method: "POST", body: JSON.stringify({ mediaId: signed.mediaId }) })).ok;
}

/** Video upload for the post and edit forms, shown next to the photos. */
export function VideoUploader({ listingId }: { listingId: string }) {
  const [videos, setVideos] = useState<{ id: string; url: string; posterUrl: string | null }[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!listingId) return;
    void listMyVideosAction(listingId).then(setVideos);
  }, [listingId]);

  async function upload(file: File) {
    if (!listingId) return setNote("Save the ad details before adding a video.");
    if (videos.length >= MAX_VIDEOS) return setNote("You can add up to 2 videos. Remove one first.");
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES) return setNote(RULE_NOTE);
    setBusy(true);
    setNote("");
    try {
      const seconds = await clipSeconds(file);
      if (!(seconds > 0) || seconds > MAX_SECONDS) return setNote(RULE_NOTE);
      const signed = await api<Signed>("/api/media/sign", {
        method: "POST",
        body: JSON.stringify({ listingId, contentType: file.type, byteSize: file.size, kind: "video" }),
      });
      if (!signed.ok) return setNote(friendlyError(signed.error));
      if (!(await sendFile(signed.data, file))) return setNote("That video could not be saved. " + RULE_NOTE);
      setVideos(await listMyVideosAction(listingId));
      setNote("Video saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await removeMyVideoAction(id);
    if (res.ok) setVideos((current) => current.filter((video) => video.id !== id));
    else setNote("That video could not be removed. Try again.");
  }

  return (
    <div data-tk="video-upload" style={{ marginTop: 16 }}>
      <h3 className="t-h3">Your videos</h3>
      <label className="tk-btn tk-btn-outline-gold" aria-disabled={busy || videos.length >= MAX_VIDEOS}>
        {busy ? "UPLOADING..." : "ADD VIDEO"}
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          data-tk="video-input"
          hidden
          disabled={busy || videos.length >= MAX_VIDEOS}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      <p className="t-small">{VIDEO_RULE_LINE}</p>
      {videos.length ? (
        <ul style={{ display: "flex", gap: 12, flexWrap: "wrap", listStyle: "none", padding: 0, marginTop: 8 }}>
          {videos.map((video, index) => (
            <li key={video.id} style={{ display: "grid", gap: 4, width: 140 }}>
              <video src={video.url} poster={video.posterUrl || undefined} muted playsInline preload="metadata" aria-label={`Video ${index + 1}`} style={{ width: 140, height: 200, objectFit: "cover", background: "#000", borderRadius: 8 }} />
              <button type="button" className="tk-btn tk-btn-outline-gold" onClick={() => void remove(video.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p data-tk="video-note" role="status">{note}</p> : null}
    </div>
  );
}
