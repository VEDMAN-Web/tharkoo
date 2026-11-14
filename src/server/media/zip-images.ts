/**
 * Reads a ZIP file in the browser or on Node 18+ without a library. Supports stored and deflated entries.
 * Only entries that can be used as images are returned: folders, hidden files and macOS metadata are skipped,
 * and so are entries bigger than `maxBytes` once unpacked or that use encryption.
 */
const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const EOCD_MIN = 22;
const EOCD_SEARCH = 65557;

export interface ZipFile {
  name: string;
  data: Uint8Array;
}

function findEndRecord(view: DataView): number {
  for (let at = view.byteLength - EOCD_MIN; at >= Math.max(0, view.byteLength - EOCD_SEARCH); at -= 1) {
    if (view.getUint32(at, true) === EOCD_SIG) return at;
  }
  return -1;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function baseName(path: string) {
  return path.split("/").pop() ?? path;
}

export async function readZipImages(buffer: ArrayBuffer, maxBytes = 8 * 1024 * 1024): Promise<ZipFile[]> {
  const view = new DataView(buffer);
  const end = findEndRecord(view);
  if (end < 0) throw new Error("This is not a ZIP file");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const bytes = new Uint8Array(buffer);
  const out: ZipFile[] = [];
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== CENTRAL_SIG) throw new Error("The ZIP file is damaged");
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const packedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const path = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    const name = baseName(path);
    if (path.endsWith("/") || path.startsWith("__MACOSX/") || name.startsWith(".") || (flags & 1) === 1) continue;
    if (size > maxBytes) continue;
    if (view.getUint32(local, true) !== LOCAL_SIG) throw new Error("The ZIP file is damaged");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const packed = bytes.subarray(start, start + packedSize);
    if (method === 0) out.push({ name, data: packed });
    else if (method === 8) out.push({ name, data: await inflateRaw(packed) });
  }
  return out;
}
