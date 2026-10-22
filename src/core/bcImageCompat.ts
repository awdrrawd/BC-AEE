// BC R132 -> R133 image-cache compatibility.
//
// R132:  GLDrawImageCache / DrawCacheImage are Map<string, HTMLImageElement>.
// R133:  both are replaced by `ImageCache` instances. `GLDrawImageCache` keeps
//        GL texture data, `DrawImageCache` keeps ImageBitmaps, and `get(url)`
//        returns a `CachedImage` (state machine + `.data`) instead of an <img>.
//        There is no `Map#set` / `Map#keys`, `gl.textureCache` is gone,
//        `DrawGetImage` returns an ImageBitmap (or undefined while loading) and
//        `GLDrawLoadTextureAlphaMask` reads mask images from `DrawImageCache`.
//
// Everything here feature-detects at call time, so a single build runs on both
// R132 and R133. Once R132 support is dropped the legacy branches can go.

type AnyRecord = Record<string, unknown>;
const win = globalThis as unknown as AnyRecord;

/** R132's draw caches were plain Maps of <img> elements; the R133 stubs no longer describe them. */
type LegacyImageMap = Map<string, HTMLImageElement>;
const legacyGlImages = () => win.GLDrawImageCache as LegacyImageMap | undefined;
const legacyDrawImages = () => win.DrawCacheImage as LegacyImageMap | undefined;
const legacyImage = (url: string) => legacyGlImages()?.get(url) ?? legacyDrawImages()?.get(url);

/** The subset of R133's `CachedImage` that this module relies on. */
interface CachedImageLike {
  state: string;
  data: unknown;
  lastUsed: number;
  isLoaded(): boolean;
  isLoading(): boolean;
  isDoneLoading(): boolean;
}

/** The subset of R133's `ImageCache` that this module relies on. */
interface ImageCacheLike {
  cache: Map<string, unknown>;
  has(url: string): boolean;
  get(url: string): CachedImageLike;
}

/**
 * An image BC can draw. At runtime this is an `HTMLImageElement` on R132 and an
 * `ImageBitmap` on R133. Both expose `width`/`height` and work with
 * `CanvasRenderingContext2D#drawImage`; only `naturalWidth/Height` are missing
 * on bitmaps, and every caller already falls back to `width/height`.
 */
export type BcDrawable = HTMLImageElement;

/**
 * True on R133+, where BC's draw caches are `ImageCache` instances.
 *
 * Detected through `GLDrawDecodeImage`, a function declaration that only R133
 * has and that exists as soon as BC's scripts have run. The caches themselves
 * are created later (on DrawLoad / GLDrawLoad), so probing them directly could
 * misdetect R132 during early startup.
 */
export function usesImageCache(): boolean {
  if (typeof win.GLDrawDecodeImage === 'function') return true;
  const cache = win.DrawImageCache as Partial<ImageCacheLike> | undefined;
  return !!cache && typeof cache === 'object'
    && typeof cache.has === 'function' && typeof cache.get === 'function';
}

function imageCache(name: 'DrawImageCache' | 'GLDrawImageCache'): ImageCacheLike | undefined {
  const cache = win[name] as Partial<ImageCacheLike> | undefined;
  return cache && typeof cache.has === 'function' && typeof cache.get === 'function'
    ? cache as ImageCacheLike : undefined;
}

function nowMs(): number {
  try { return typeof CommonTime === 'function' ? CommonTime() : Date.now(); } catch { return Date.now(); }
}

/**
 * The decoded pixels of an already-loaded image, or null when it isn't ready.
 *
 * R132: look in GLDrawImageCache, then DrawCacheImage (non-creating).
 * R133: read DrawImageCache. Note `ImageCache#get` starts loading unknown URLs,
 *       so the first call for a URL returns null and a later one succeeds.
 */
export function getLoadedImage(url: string): BcDrawable | null {
  if (usesImageCache()) {
    const entry = imageCache('DrawImageCache')?.get(url);
    return entry?.isLoaded() && entry.data ? entry.data as BcDrawable : null;
  }
  const image = legacyImage(url);
  if (!image || image.complete === false) return null;
  return (image.naturalWidth || image.width) > 0 ? image : null;
}

/**
 * True while BC is still loading `url` into one of its draw caches.
 * Unknown URLs (never requested, or already purged) are NOT pending.
 */
export function isImagePending(url: string): boolean {
  if (usesImageCache()) {
    for (const name of ['GLDrawImageCache', 'DrawImageCache'] as const) {
      const cache = imageCache(name);
      if (cache?.has(url) && !cache.get(url).isDoneLoading()) return true;
    }
    return false;
  }
  return legacyImage(url)?.complete === false;
}

/**
 * Release temporary per-character canvases that R132 cached by name.
 * R133 draws transient canvases without caching them, so there is nothing to do.
 */
export function releaseNamedTextures(prefix: string): void {
  if (usesImageCache()) return;
  const gl = GLDrawCanvas?.GL as (WebGL2RenderingContext & {textureCache?: Map<string, {texture: WebGLTexture}>}) | undefined;
  const textureCache = gl?.textureCache;
  if (gl && textureCache) {
    for (const [key, data] of textureCache) {
      if (!key.startsWith(prefix)) continue;
      gl.deleteTexture(data.texture);
      textureCache.delete(key);
    }
  }
  const images = legacyGlImages();
  if (!images) return;
  for (const key of [...images.keys()]) {
    if (key.startsWith(prefix)) images.delete(key);
  }
}

/** R132 only: make BC's own GL cache return `image` for `url` (R133's ImageCache is fed by `seedDrawImage`). */
export function setLegacyGlImage(url: string, image: HTMLImageElement): void {
  legacyGlImages()?.set(url, image);
}

/** R132 only: ask BC to redraw characters wearing `image` once it has decoded (removed in R133). */
export function refreshCharactersForLegacyImage(image: HTMLImageElement): void {
  (win.DrawRefreshCharacterForImage as ((image: HTMLImageElement) => void) | undefined)?.(image);
}

/** Marker for entries we put into BC's cache ourselves. */
const SEEDED = Symbol('aeeSeeded');

/**
 * R133 only. Make `DrawImageCache.get(url)` return `image` (once decoded).
 *
 * `GLDrawLoadTextureAlphaMask` reads mask layers straight from DrawImageCache,
 * so this is the only place to inject our generated mask images. The entry is
 * a duck-typed `CachedImage` whose `unload()` is a no-op on purpose: BC's own
 * dispose callback calls `bitmap.close()`, which an <img> does not have.
 * BC's periodic purge may drop the entry; callers simply seed again on the
 * next build.
 */
export function seedDrawImage(url: string, image: HTMLImageElement): void {
  const cache = imageCache('DrawImageCache');
  if (!cache) return;
  const ready = image.complete && image.naturalWidth > 0;
  const state = ready ? 'loaded' : 'loading';
  const existing = cache.cache.get(url) as (CachedImageLike & {[SEEDED]?: boolean; unload?: () => void}) | undefined;
  if (existing && !existing[SEEDED]) {
    try { existing.unload?.(); } catch { /* ignore */ }
  }
  const entry = {
    [SEEDED]: true,
    cache, url, state,
    data: ready ? image : null,
    lastUsed: nowMs(),
    _generation: 0,
    async _load() { /* already provided by us */ },
    unload() { /* keep: see doc comment */ },
    _dispose() { /* keep */ },
    isAsset() { return false; },
    isLoaded() { return this.state === 'loaded'; },
    isLoading() { return this.state === 'loading'; },
    isDoneLoading() { return this.state === 'loaded'; },
    isFailing() { return false; },
  };
  cache.cache.set(url, entry);
}

/**
 * Upload an <img> into a GL texture and record its size.
 * Same behaviour as R132's `GLDrawBingImageToTextureInfo`, which R133 removed.
 */
export function uploadImageToTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  image: HTMLImageElement,
  info: {width: number; height: number; texture: WebGLTexture},
): void {
  info.width = image.width;
  info.height = image.height;
  gl.bindTexture(gl.TEXTURE_2D, info.texture);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } catch (error) {
    if (error instanceof Error && error.name === 'SecurityError') {
      console.error(`[AEE] Failed to upload image "${image.src.slice(0, 64)}":`, error);
    } else {
      throw error;
    }
  }
}
