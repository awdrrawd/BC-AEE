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

// 2D item-menu preview thumbnails go through DrawGetImage. Free-draw groups
// show the naked-space preview; single glove is intentionally text-only.
const PreviewProviders: Record<string, () => string> = {
  ItemCanvas: () => NAKED_DATAURL, // covers ItemCanvas1/2/3 (hidden *Mask groups have no preview)
};
const previewImgCache = new Map<string, HTMLImageElement>();

function drawGetImageHook(args: [string], next: (a: [string]) => unknown) {
  const src = args[0];
  if (typeof src === 'string' && src.indexOf('Preview') >= 0) {
    for (const key in PreviewProviders) {
      if (src.indexOf(key) >= 0) {
        let im = previewImgCache.get(src);
        if (!im) { im = new Image(); im.src = PreviewProviders[key](); previewImgCache.set(src, im); }
        return im;
      }
    }
  }
  return next(args);
}

export function installImagePatch(): boolean {
  if (imagePatchInstalled) return true;
  if (typeof GLDrawLoadImage !== 'function') return false;

  bcAeeModSdk.hookFunction('GLDrawLoadImage', 10, glLoadImageHook as never);
  if (typeof DrawGetImage === 'function') bcAeeModSdk.hookFunction('DrawGetImage', 10, drawGetImageHook as never);
  imagePatchInstalled = true;
  console.log('[AEE Mask] GLDrawLoadImage + DrawGetImage 影像注入已掛上');
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
