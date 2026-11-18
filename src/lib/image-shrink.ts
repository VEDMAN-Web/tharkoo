/**
 * H13.1 part 2: photos of any size are accepted. Before a photo is sent, the browser makes it smaller when it is over the upload limit or
 * wider or taller than 2560 px: the long side goes to at most 2560 px and the picture is saved as JPEG (WEBP stays WEBP) at quality 0.85;
 * if it is still over the limit the quality steps down (0.8, 0.75, 0.7) and then the long side (2048, 1600) until it fits.
 * The picture keeps its orientation (a phone photo is turned the right way up), is never made bigger, and a photo that already fits is sent untouched.
 * Only the browser's own canvas and createImageBitmap are used: no package. The server limits stay as the backstop.
 */

export const MAX_LONG_SIDE = 2560;
export const SHRINK_SIDES = [2560, 2048, 1600] as const;
export const SHRINK_QUALITIES = [0.85, 0.8, 0.75, 0.7] as const;
/** The last try when nothing above fits: a small, strongly compressed picture. */
const LAST_SIDE = 1280;
const LAST_QUALITY = 0.6;

export const UNREADABLE_PHOTO = "This photo could not be read. Try another photo or take a screenshot of it.";

export type Shrunk = { ok: true; file: File; changed: boolean } | { ok: false; error: string };

/** What the shrinker needs from the browser, so the arithmetic can be tested without one. */
export type ShrinkDeps = {
  /** The picture's size as it is shown (orientation applied), or null when the file cannot be read as a picture. */
  read(): Promise<{ width: number; height: number } | null>;
  /** The picture drawn at this size and saved as a file of this type and quality, or null when it could not be saved. */
  encode(width: number, height: number, type: string, quality: number): Promise<Blob | null>;
  close?(): void;
};

/** The sizes to try, biggest first, never bigger than the picture itself. */
function sidesFor(longSide: number): number[] {
  const wanted = SHRINK_SIDES.map((side) => Math.min(side, longSide));
  return wanted.filter((side, index) => wanted.indexOf(side) === index);
}

function renamed(name: string, type: string): string {
  const stem = name.replace(/\.[^./\\]+$/, "") || "photo";
  return `${stem}.${type === "image/webp" ? "webp" : "jpg"}`;
}

/** Makes a photo fit `limitBytes` and 2560 px, or says it cannot be read. A photo that already fits comes back as the very same file. */
export async function shrinkPhoto(file: File, limitBytes: number, deps: ShrinkDeps = browserDeps(file)): Promise<Shrunk> {
  try {
    const size = await deps.read();
    if (!size || !(size.width >= 1) || !(size.height >= 1)) return { ok: false, error: UNREADABLE_PHOTO };
    const longSide = Math.max(size.width, size.height);
    if (file.size <= limitBytes && longSide <= MAX_LONG_SIDE) return { ok: true, file, changed: false };
    const type = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    const tries: [number, number][] = [];
    for (const side of sidesFor(longSide)) for (const quality of SHRINK_QUALITIES) tries.push([side, quality]);
    tries.push([Math.min(LAST_SIDE, longSide), LAST_QUALITY]);
    for (const [side, quality] of tries) {
      const scale = Math.min(1, side / longSide);
      const blob = await deps.encode(Math.max(1, Math.round(size.width * scale)), Math.max(1, Math.round(size.height * scale)), type, quality);
      if (blob && blob.size > 0 && blob.size <= limitBytes) {
        return { ok: true, file: new File([blob], renamed(file.name, type), { type, lastModified: file.lastModified }), changed: true };
      }
    }
    return { ok: false, error: UNREADABLE_PHOTO };
  } catch {
    return { ok: false, error: UNREADABLE_PHOTO };
  } finally {
    deps.close?.();
  }
}

/** The browser's own decoding and canvas. The picture is read once and drawn for each try. */
export function browserDeps(file: File): ShrinkDeps {
  let bitmap: ImageBitmap | null = null;
  return {
    async read() {
      try {
        // "from-image" turns a phone photo the right way up before anything is drawn.
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        return { width: bitmap.width, height: bitmap.height };
      } catch {
        return null;
      }
    },
    async encode(width, height, type, quality) {
      if (!bitmap) return null;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      // JPEG has no transparency: a see-through PNG gets a white background instead of black.
      if (type === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
    },
    close() {
      bitmap?.close();
      bitmap = null;
    },
  };
}
