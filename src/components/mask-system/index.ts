// Mask system entry point: single glove + free-draw ×3 + shared masking.
// Ported from the standalone userscript 自由繪圖_合併單手套.user.js and wired
// into AEE's hook installer (see src/hooks/index.ts).

import bcAeeModSdk from '@/modsdk';
import {installImagePatch} from './masking';
import {registerSingleGlove, reconcileSingleGlove} from './singleGlove';
import {registerFreeDrawGroups, installFreeDrawCallbacks, renderOverlay, cacheDrawArgs, maskRefresh} from './freeDraw';

export {MaskIcon, MASK_ICON_SVG, MASK_ICON_URL} from './icons';
export type {MaskIconName} from './icons';

let started = false;
let drawHooked = false;
let callbacksInstalled = false;

function registerAll(): boolean {
  let ok = registerFreeDrawGroups();
  ok = registerSingleGlove() && ok;
  return ok;
}

// Draw the overlay + reconcile single glove after BC renders the character.
function tryHookDrawCharacter(): boolean {
  if (drawHooked) return true;
  if (typeof DrawCharacter !== 'function') return false;
  bcAeeModSdk.hookFunction('DrawCharacter', 1, (args, next) => {
    const ret = next(args);
    const [C, X, Y, Zoom, IsHeightResizeAllowed] = args;
    cacheDrawArgs(C, X, Y, Zoom, IsHeightResizeAllowed);
    reconcileSingleGlove(C);
    renderOverlay(C, X, Y, Zoom, IsHeightResizeAllowed);
    return ret;
  });
  drawHooked = true;
  return true;
}

export function installMaskSystem() {
  if (started) return;
  started = true;

  // BC assets / draw functions may not be ready the instant the bundle loads;
  // retry until image patch + registration + hook are all in place.
  const timer = setInterval(() => {
    const patch = installImagePatch();
    const registered = registerAll();
    tryHookDrawCharacter();

    if (patch && registered && !callbacksInstalled) {
      callbacksInstalled = true;
      installFreeDrawCallbacks();
    }
    if (patch && registered && drawHooked && callbacksInstalled) {
      clearInterval(timer);
      (window as unknown as Record<string, unknown>).AEEMaskRefresh = maskRefresh;
      console.log('[AEE Mask] 就緒：自由繪圖 ×3（純繪製／遮罩切換）＋ 單手套 ×1（Priority=99）');
    }
  }, 500);
}
