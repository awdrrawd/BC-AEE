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

// GLDrawLoadImage hook: return our injected texture for mask asset URLs.
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

  let textureInfo = gl.textureCache?.get(url);
  if (!textureInfo) {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    textureInfo = {width: 1, height: 1, texture: tex};
    gl.textureCache?.set(url, textureInfo);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    let img = GLDrawImageCache.get(url);
    if (img) {
      GLDrawBingImageToTextureInfo(gl as never, img, textureInfo);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      img = new Image();
      GLDrawImageCache.set(url, img);
      img.addEventListener('load', () => {
        GLDrawBingImageToTextureInfo(gl as never, img!, textureInfo!);
        DrawRefreshCharacterForImage(img!);
      });
      img.addEventListener('error', () => console.error('[AEE Mask] 遮罩圖片載入失敗：' + url));
      img.src = dataUrl;
    }
  }
  return textureInfo;
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

// Clear all our injected textures so the next build re-requests them (and the
// providers can return the building character's own shape).
export function bustAllInjectedTextures() {
  for (const name in MaskImageProviders) bustMaskTexture(name);
}

export function installImagePatch(): boolean {
  if (imagePatchInstalled) return true;
  if (typeof GLDrawLoadImage !== 'function') return false;

  bcAeeModSdk.hookFunction('GLDrawLoadImage', 10, glLoadImageHook as never);
  if (typeof DrawGetImage === 'function') bcAeeModSdk.hookFunction('DrawGetImage', 10, drawGetImageHook as never);
  // Track the character being built + force per-character mask reload.
  if (typeof GLDrawAppearanceBuild === 'function') {
    bcAeeModSdk.hookFunction('GLDrawAppearanceBuild', 6, (args, next) => {
      buildingChar = (args as unknown as [Character])[0] ?? null;
      bustAllInjectedTextures();
      try { return next(args); } finally { buildingChar = null; }
    });
  }
  imagePatchInstalled = true;
  console.log('[AEE Mask] GLDrawLoadImage + DrawGetImage + 每角色遮罩注入已掛上');
  return true;
}

// Clear both GL caches (source `textureCache` AND combined `maskCache`) so a
// dynamic mask change actually re-renders.
function clearGLMaskCaches(gl: BCGLContext | null, name: string) {
  if (!gl) return;
  if (gl.textureCache) {
    for (const k of Array.from(gl.textureCache.keys())) if (k.includes(name)) gl.textureCache.delete(k);
  }
  if (gl.maskCache) gl.maskCache.clear();
}

export function bustMaskTexture(name: string) {
  try {
    clearGLMaskCaches(LastGL, name);
    if (typeof GLDrawCanvas !== 'undefined' && GLDrawCanvas && GLDrawCanvas.getContext) {
      const gl2 = (GLDrawCanvas.getContext('webgl2') || GLDrawCanvas.getContext('webgl')) as BCGLContext | null;
      if (gl2 && gl2 !== LastGL) clearGLMaskCaches(gl2, name);
    }
    if (typeof GLDrawImageCache !== 'undefined' && GLDrawImageCache.forEach) {
      for (const k of Array.from(GLDrawImageCache.keys())) if (k.includes(name)) GLDrawImageCache.delete(k);
    }
  } catch (e) {
    console.warn('[AEE Mask] 清材質快取失敗（可忽略）：', e);
  }
}
