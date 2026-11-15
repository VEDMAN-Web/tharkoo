"use client";

import { Notice } from "@/components/admin/ui";
import { UploadBox, type UploadItem } from "@/components/upload/UploadBox";
import { UPLOAD_RULES } from "@/components/upload/rules";
import type { MediaItem } from "./useAdMedia";

interface Props {
  kind: "image" | "video";
  items: MediaItem[];
  limit: number;
  /** H6.18: the photos and videos total, shown under the label. */
  totalNote?: string;
  note: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
  onMove: (key: string, step: number) => void;
  onCover?: (key: string) => void;
}

/** H7.8: the create-ad photo and video boxes, now the shared upload box (see src/components/upload). */
export function AdMediaPicker({ kind, items, limit, totalNote, note, disabled, onFiles, onRemove, onMove, onCover }: Props) {
  const rule = kind === "image" ? UPLOAD_RULES.adPhotos : UPLOAD_RULES.adVideos;
  const label = kind === "image" ? "Photos" : "Videos";
  const uploads: UploadItem[] = items.map((item) => ({
    key: item.key,
    name: item.name,
    kind,
    previewUrl: item.previewUrl || undefined,
    state: item.state,
    progress: item.progress,
    error: item.error,
  }));
  return (
    <div className="adm-stack" style={{ minWidth: 0 }}>
      <UploadBox
        label={label}
        rule={rule}
        items={uploads}
        limit={limit}
        disabled={disabled}
        hint={totalNote}
        onFiles={onFiles}
        onRemove={onRemove}
        onMove={onMove}
        onCover={kind === "image" ? onCover : undefined}
      />
      {note ? <Notice kind="info">{note}</Notice> : null}
    </div>
  );
}
