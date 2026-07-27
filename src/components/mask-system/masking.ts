// Shared image injection + cache busting for every mask (single glove + the
// three free-draw masks). Ported from the userscript's section 0.

import bcAeeModSdk from '@/modsdk';
import {NAKED_DATAURL} from './assets';

type MaskProvider = string | (() => string);

// providers[key] = dataURL string or () => dataURL; matched with url.includes(key).
export const MaskImageProviders: Record<string, MaskProvider> = {};

// BC adds `textureCache` / `maskCache` onto the GL context; not in the WebGL types.
type BCGLContext = (WebGL2RenderingContext | WebGLRenderingContext) & {
  textureCache?: Map<string, {width: number; height: number; texture: WebGLTexture}>;
  maskCache?: Map<string, unknown>;
};

let LastGL: BCGLContext | null = null;
// Re-hook on every install: bcModSdk allowReplace drops old hooks, so use a
// module-local flag rather than a persistent window flag.
let imagePatchInstalled = false;

function transparentPx(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL('image/png');
}
export const TRANSPARENT_DATAURL = transparentPx();

type TexInfo = {width: number; height: number; texture: WebGLTexture; ready?: boolean};

// Content-keyed caches. These are NEVER busted, so a given mask image is decoded
// once and every later bind is SYNCHRONOUS — no transparent frame, no async
// `DrawRefreshCharacterForImage` rebuild loop, i.e. no flicker. Each distinct
// image (per-character drawing / glove side) gets its own persistent texture, so
// characters never collide on BC's URL-keyed cache. (Only the COMBINED mask is
// re-computed per build — see the GLDrawAppearanceBuild hook.)
const ourImageCache = new Map<string, HTMLImageElement>();
const ourTexCache = new WeakMap<BCGLContext, Map<string, TexInfo>>();

function texCacheFor(gl: BCGLContext): Map<string, TexInfo> {
  let m = ourTexCache.get(gl);
  if (!m) { m = new Map(); ourTexCache.set(gl, m); }
  return m;
}
function ensureDecoded(dataUrl: string): HTMLImageElement {
  let img = ourImageCache.get(dataUrl);
  if (!img) {
    img = new Image();
    ourImageCache.set(dataUrl, img);
    // Fires once per NEW image; the ensuing rebuild binds synchronously.
    img.addEventListener('load', () => { try { DrawRefreshCharacterForImage(img!); } catch { /* ignore */ } });
    img.addEventListener('error', () => console.error('[AEE Mask] 遮罩圖片載入失敗'));
    img.src = dataUrl;
  }
  return img;
}

// GLDrawLoadImage hook: return our per-content injected texture for mask URLs.
function glLoadImageHook(args: [BCGLContext, string], next: (a: [BCGLContext, string]) => unknown) {
  const gl = args[0], url = args[1];
  LastGL = gl;

  let dataUrl: string | null = null;
  for (const name in MaskImageProviders) {
    if (url.includes(name)) {
      const p = MaskImageProviders[name];
      dataUrl = typeof p === 'function' ? p() : p;
      if (dataUrl) break;
    }
  }
  if (!dataUrl) return next(args); // not our asset → original flow

  const cache = texCacheFor(gl);
  const img = ensureDecoded(dataUrl);
  let ti = cache.get(dataUrl);
  if (ti) {
    if (!ti.ready && img.complete && img.naturalWidth) { // deferred upload once decoded
      gl.bindTexture(gl.TEXTURE_2D, ti.texture);
      GLDrawBingImageToTextureInfo(gl as never, img, ti);
      ti.ready = true;
    }
    return ti;
  }

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  ti = {width: 1, height: 1, texture: tex};
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  if (img.complete && img.naturalWidth) {
    GLDrawBingImageToTextureInfo(gl as never, img, ti);
    ti.ready = true;
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  }
  cache.set(dataUrl, ti);
  return ti;
}

// Does this character wear any of OUR masks (single glove / free-draw masks)?
function characterUsesOurMasks(C: Character | null): boolean {
  if (!C || !Array.isArray(C.Appearance)) return false;
  return C.Appearance.some(it => {
    const n = it?.Asset?.Group?.Name as string | undefined;
    return n === 'SingleGloveFX' || (typeof n === 'string' && n.startsWith('ItemCanvas') && n.endsWith('Mask'));
  });
}

// Clear ONLY the combined-mask cache (keeps source textures), forcing BC to
// re-combine this build from our per-content source textures.
function clearMaskCaches() {
  try {
    if (LastGL?.maskCache) LastGL.maskCache.clear();
    if (typeof GLDrawCanvas !== 'undefined' && GLDrawCanvas && GLDrawCanvas.getContext) {
      const gl2 = (GLDrawCanvas.getContext('webgl2') || GLDrawCanvas.getContext('webgl')) as BCGLContext | null;
      if (gl2 && gl2 !== LastGL && gl2.maskCache) gl2.maskCache.clear();
    }
  } catch { /* ignore */ }
}

// 2D item-menu preview thumbnails go through DrawGetImage. We inject our own
// preview image when a URL matches a registered rule. Free-draw groups show the
// naked-space preview; single glove shows the glove picture ONLY for its base
// item thumbnail (its 6 typed options stay text-only).
export interface PreviewRule {
  match: (src: string) => boolean;
  url: () => string;
}
const previewRules: PreviewRule[] = [
  {match: (src) => src.includes('ItemCanvas'), url: () => NAKED_DATAURL}, // ItemCanvas1/2/3 (hidden *Mask groups have no preview)
];
export function addPreviewRule(rule: PreviewRule) { previewRules.push(rule); }

const previewImgCache = new Map<string, HTMLImageElement>();

function drawGetImageHook(args: [string], next: (a: [string]) => unknown) {
  const src = args[0];
  if (typeof src === 'string' && src.indexOf('Preview') >= 0) {
    for (const rule of previewRules) {
      if (rule.match(src)) {
        let im = previewImgCache.get(src);
        if (!im) { im = new Image(); im.src = rule.url(); previewImgCache.set(src, im); }
        return im;
      }
    }
  }
  return next(args);
}

// Which character BC is currently building the GL canvas for. Mask providers
// read this so each character gets ITS OWN mask shape (BC caches textures by
// URL globally, so we bust + reload per build). Null outside a build.
let buildingChar: Character | null = null;
export function getBuildingChar(): Character | null { return buildingChar; }

export function installImagePatch(): boolean {
  if (imagePatchInstalled) return true;
  if (typeof GLDrawLoadImage !== 'function') return false;

  bcAeeModSdk.hookFunction('GLDrawLoadImage', 10, glLoadImageHook as never);
  if (typeof DrawGetImage === 'function') bcAeeModSdk.hookFunction('DrawGetImage', 10, drawGetImageHook as never);
  // Track the character being built; for characters that use our masks, force a
  // per-character re-combine (source textures stay cached → no flicker).
  if (typeof GLDrawAppearanceBuild === 'function') {
    bcAeeModSdk.hookFunction('GLDrawAppearanceBuild', 6, (args, next) => {
      const C = (args as unknown as [Character])[0] ?? null;
      buildingChar = C;
      if (characterUsesOurMasks(C)) clearMaskCaches();
      try { return next(args); } finally { buildingChar = null; }
    });
  }
  imagePatchInstalled = true;
  console.log('[AEE Mask] GLDrawLoadImage + DrawGetImage + 每角色遮罩注入已掛上');
  return true;
}

// Force a mask re-combine after content changed (edit / glove switch). Source
// textures are content-keyed and never dropped, so the re-bind stays synchronous.
export function bustMaskTexture() {
  clearMaskCaches();
}
export function bustAllInjectedTextures() {
  clearMaskCaches();
}
