import { VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_TYPES } from "@/server/media/config";

/** A video the staff member chose, as the browser sees it. The bytes are checked again on the server at upload. */
export interface ChosenVideo {
  name: string;
  size: number;
  type: string;
  /** Length in seconds, or null when the browser could not read it. */
  seconds: number | null;
}

const EXTENSION_TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
const VIDEO_NAME = /\.(mp4|webm|mov|m4v|avi|mkv|ogv|3gp)$/i;
const MB = 1024 * 1024;

function extensionOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** True for a file chosen as a video. Other video formats count too, so that the check can say they are the wrong type. */
export function isVideoFile(file: { name: string; type: string }) {
  return file.type.startsWith("video/") || VIDEO_NAME.test(file.name);
}

/**
 * The video type to use. A browser type of mp4, webm or mov wins. Otherwise the extension decides,
 * because some systems give no type or a generic one. Returns the browser type when neither fits, so the check refuses it.
 */
export function videoTypeOf(file: { name: string; type: string }): string {
  if ((VIDEO_TYPES as readonly string[]).includes(file.type)) return file.type;
  const fromName = EXTENSION_TYPES[extensionOf(file.name)];
  if (fromName && !file.type.startsWith("video/")) return fromName;
  return file.type;
}

/** Reads the videos column: file names separated by | (or ;). Videos are chosen files only, never links. */
export function parseVideoCell(cell: string): string[] {
  return cell
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Why a chosen video cannot be used, or null. The same rule as the post-ad form and the server upload. */
export function videoProblem(video: ChosenVideo): string | null {
  if (!(VIDEO_TYPES as readonly string[]).includes(video.type)) return `Video ${video.name} is not mp4, webm or mov`;
  if (video.size === 0) return `Video ${video.name} is empty`;
  if (video.size > VIDEO_MAX_BYTES) return `Video ${video.name} is larger than ${VIDEO_MAX_BYTES / MB} MB`;
  if (video.seconds === null || !(video.seconds > 0)) return `Video ${video.name} could not be read. Use an mp4, webm or mov video`;
  if (video.seconds > VIDEO_MAX_SECONDS) return `Video ${video.name} is longer than ${VIDEO_MAX_SECONDS} seconds`;
  return null;
}
