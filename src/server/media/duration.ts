/** Reads the play length (seconds) of an mp4 / mov / webm file held in memory. Returns null when it cannot be read. */

function u32(buf: Buffer, at: number) {
  return at + 4 <= buf.length ? buf.readUInt32BE(at) : null;
}

/** Walks ISO-BMFF boxes looking for moov > mvhd. Works whether moov is at the start or the end. */
function mp4Seconds(buf: Buffer, start = 0, end = buf.length, depth = 0): number | null {
  let at = start;
  while (at + 8 <= end) {
    let size = u32(buf, at);
    const type = buf.toString("latin1", at + 4, at + 8);
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) return null;
      size = Number(buf.readBigUInt64BE(at + 8));
      header = 16;
    } else if (size === 0) size = end - at;
    if (size === null || size < header) return null;
    const boxEnd = Math.min(at + size, end);
    if (type === "mvhd") {
      const version = buf[at + header];
      const base = at + header + 4;
      if (version === 1) {
        if (base + 28 > buf.length) return null;
        const scale = buf.readUInt32BE(base + 16);
        const duration = Number(buf.readBigUInt64BE(base + 20));
        return scale > 0 ? duration / scale : null;
      }
      const scale = u32(buf, base + 8);
      const duration = u32(buf, base + 12);
      return scale && duration !== null ? duration / scale : null;
    }
    if (type === "moov" && depth < 2) {
      const inner = mp4Seconds(buf, at + header, boxEnd, depth + 1);
      if (inner !== null) return inner;
    }
    at = boxEnd;
  }
  return null;
}

/** Finds the first EBML element with the given id inside the first 64 KB and returns its payload bytes. */
function ebmlPayload(buf: Buffer, id: number[], limit: number): Buffer | null {
  const max = Math.min(buf.length, limit) - id.length - 1;
  for (let i = 0; i < max; i += 1) {
    if (!id.every((byte, k) => buf[i + k] === byte)) continue;
    const first = buf[i + id.length];
    let length = 1;
    while (length <= 8 && !(first & (0x80 >> (length - 1)))) length += 1;
    if (length > 8) continue;
    let size = first & (0xff >> length);
    for (let k = 1; k < length; k += 1) size = size * 256 + buf[i + id.length + k];
    const from = i + id.length + length;
    if (from + size > buf.length || size > 8) continue;
    return buf.subarray(from, from + size);
  }
  return null;
}

function ebmlNumber(payload: Buffer) {
  let value = 0;
  for (const byte of payload) value = value * 256 + byte;
  return value;
}

function webmSeconds(buf: Buffer): number | null {
  const scale = ebmlPayload(buf, [0x2a, 0xd7, 0xb1], 65536);
  const duration = ebmlPayload(buf, [0x44, 0x89], 65536);
  if (!duration) return null;
  let value: number;
  if (duration.length === 4) value = duration.readFloatBE(0);
  else if (duration.length === 8) value = duration.readDoubleBE(0);
  else return null;
  const nanos = scale ? ebmlNumber(scale) : 1_000_000;
  return (value * nanos) / 1e9;
}

export function videoSeconds(buf: Buffer, contentType: string): number | null {
  const seconds = contentType === "video/webm" ? webmSeconds(buf) : mp4Seconds(buf);
  return seconds !== null && Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
