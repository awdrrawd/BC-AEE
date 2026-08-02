import bcAeeModSdk from '@/modsdk';

// Keep BC's character/asset canvas readable so the 吸管/eyedropper's getImageData
// never hits a SecurityError.
//
// BC's 2D asset loader starts every image with crossOrigin="anonymous"
// (Drawing.js DrawGetImage) but, after an image fails to load twice, RETRIES it
// WITHOUT crossOrigin (DrawGetImageOnError → `Img.crossOrigin = null`). The
// moment one such non-CORS image is drawn onto MainCanvas, the canvas is TAINTED
// for the rest of the session and every getImageData throws — which is exactly
// why the eyedropper was "unstable": it worked until some flaky or cross-origin
// asset (ECHO from jsdelivr, a custom item preview, a momentarily-500 CDN)
// tripped that fallback, after which the loupe silently showed nothing and no
// colour could be picked.
//
// Fix: lock crossOrigin='anonymous' on every image DrawGetImage hands out, so
// BC's no-CORS fallback (`Img.crossOrigin = null`) becomes a no-op and the canvas
// can never be tainted. Trade-off: an asset served with NO CORS headers won't
// display at all (rare in the BC / jsdelivr / GitHub-Pages ecosystem, which all
// send CORS) instead of tainting the whole canvas and killing the eyedropper.
//
// (The WebGL path — GLDraw.js — can't taint MainCanvas: a cross-origin texture
// without CORS makes texImage2D throw at upload rather than silently tainting, so
// GLDrawCanvas stays origin-clean and its blit onto MainCanvas is safe.)

let installed = false;
const LOCK = Symbol('aeeCorsLock');

export function installCanvasCorsHooks() {
  if (installed) return;
  installed = true;

  const timer = setInterval(() => {
    if (typeof DrawGetImage !== 'function') return;
    clearInterval(timer);
    bcAeeModSdk.hookFunction('DrawGetImage', 0, (args, next) => {
      const img = next(args) as (HTMLImageElement & {[LOCK]?: boolean}) | null | undefined;
      try {
        if (img && typeof img === 'object' && 'crossOrigin' in img && !img[LOCK]) {
          img[LOCK] = true;
          if (!img.crossOrigin) img.crossOrigin = 'anonymous';
          // Shadow the instance property so BC's `Img.crossOrigin = null` fallback
          // silently no-ops → the underlying CORS attribute stays 'anonymous'.
          Object.defineProperty(img, 'crossOrigin', {
            configurable: true,
            get: () => 'anonymous',
            set: () => { /* ignore: never drop CORS, keep the canvas readable */ },
          });
        }
      } catch { /* never let CORS-hardening break drawing */ }
      return img;
    });
  }, 500);
}
