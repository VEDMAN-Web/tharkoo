"use client";

import { useCallback, useRef, useState } from "react";
import { moveItem } from "@/components/upload/rules";
import { refusalFor, uploadAdMedia, type MediaKind } from "./ad-upload";

export interface MediaItem {
  key: string;
  name: string;
  previewUrl: string;
  state: "uploading" | "ready" | "failed";
  /** 0 to 1 while the file is sent. */
  progress?: number;
  /** H7.8: the file size in bytes, shown on the tile. */
  size: number;
  mediaId: string;
  error: string;
}

/** H7.8: a refused or failed file does not count toward the limit. */
const countsToward = (item: MediaItem) => item.state !== "failed";

/**
 * The photo or video list of the create-ad form. Files upload one at a time as they are chosen.
 * The first photo is the cover. `ownerEmail` is the account the files belong to.
 */
export function useAdMedia(kind: MediaKind, limit: number, ownerEmail: string) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [note, setNote] = useState("");
  const counter = useRef(0);

  const patch = useCallback((key: string, change: Partial<MediaItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)));
  }, []);

  const add = useCallback(
    async (files: File[]) => {
      const room = limit - items.filter(countsToward).length;
      if (room <= 0) {
        setNote(`The limit is ${limit}. Remove one first.`);
        return;
      }
      setNote(files.length > room ? `Only ${room} more fit. The limit is ${limit}.` : "");
      const fresh = files.slice(0, room).map((file) => {
        counter.current += 1;
        // H7.8: both kinds get a preview; a video shows its first frame in the box.
        return { file, item: { key: `${Date.now()}-${counter.current}`, name: file.name, previewUrl: URL.createObjectURL(file), state: "uploading" as const, progress: 0, size: file.size, mediaId: "", error: "" } };
      });
      setItems((current) => [...current, ...fresh.map((entry) => entry.item)]);
      for (const entry of fresh) {
        const refusal = await refusalFor(entry.file, kind);
        if (refusal) {
          patch(entry.item.key, { state: "failed", error: refusal });
          continue;
        }
        const result = await uploadAdMedia(entry.file, kind, ownerEmail, (ratio) => patch(entry.item.key, { progress: ratio }));
        patch(entry.item.key, result.ok ? { state: "ready", mediaId: result.mediaId } : { state: "failed", error: result.error });
      }
    },
    [items, kind, limit, ownerEmail, patch],
  );

  const remove = useCallback(
    (key: string) => {
      const found = items.find((item) => item.key === key);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      setItems((current) => current.filter((item) => item.key !== key));
    },
    [items],
  );

  const move = useCallback((key: string, step: number) => {
    setItems((current) => {
      const from = current.findIndex((item) => item.key === key);
      return from < 0 ? current : moveItem(current, from, step);
    });
  }, []);

  const makeCover = useCallback((key: string) => {
    setItems((current) => {
      const from = current.findIndex((item) => item.key === key);
      return from <= 0 ? current : moveItem(current, from, -from);
    });
  }, []);

  const reset = useCallback(() => {
    items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
    setItems([]);
    setNote("");
  }, [items]);

  return {
    items,
    /** H7.8: the files that count toward the limit (refused ones do not). */
    counted: items.filter(countsToward).length,
    note,
    add,
    remove,
    move,
    makeCover,
    reset,
    busy: items.some((item) => item.state === "uploading"),
    readyIds: items.filter((item) => item.state === "ready").map((item) => item.mediaId),
    failed: items.filter((item) => item.state === "failed").length,
  };
}
