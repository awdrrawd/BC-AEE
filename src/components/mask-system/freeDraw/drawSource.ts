// Gatekeeper for every free-draw image source before it reaches an <img>.
//
// A drawing reaches the renderer in exactly two legitimate shapes, and both are a data URL by then:
//   - embedded: Property.CustomDraw = LZString.compressToBase64('data:image/png;base64,...')
//   - SPS:      downloaded, hash-checked, then turned into 'data:image/<png|webp>;base64,...' by spsDrawing
// Property.CustomDraw also arrives from other players and from imported outfits, so it is untrusted. Anything that
// is not (or does not decompress to) a png/webp data URL is rejected: it must never become an <img src>, because
// a URL there makes every viewer's browser contact a host the sender chose (IP disclosure, presence tracking).

import {LRUCache} from '../lruCache';

// 3.3 MB of image bytes (the SPS slot limit) is ~4.4M base64 chars; leave headroom for the data: prefix.
export const MAX_DRAW_SOURCE_CHARS = 4_600_000;
const ALLOWED_DATA_URL = /^data:image\/(?:png|webp);base64,/;

// Decompressing a multi-MB string is not free and the renderer asks every frame, so remember verdicts.
const verdicts = new LRUCache<string, string | null>(64);

/** The data URL to load for `source`, or null when it is not a valid free-draw image source. */
export function drawImageSource(source: unknown): string | null {
  if (typeof source !== 'string' || !source || source.length > MAX_DRAW_SOURCE_CHARS) return null;
  if (ALLOWED_DATA_URL.test(source)) return source; // already a data URL (SPS cache entries)
  const known = verdicts.get(source);
  if (known !== undefined) return known;
  let decoded: string | null = null;
  try {
    const text = typeof LZString !== 'undefined' ? LZString.decompressFromBase64(source) : null;
    if (text && text.length <= MAX_DRAW_SOURCE_CHARS && ALLOWED_DATA_URL.test(text)) decoded = text;
  } catch { /* malformed payload from another client: treat as invalid */ }
  verdicts.set(source, decoded);
  return decoded;
}
