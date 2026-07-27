// Mask system entry point: single glove + free-draw ×3 + shared masking.
// Ported from the standalone userscript 自由繪圖_合併單手套.user.js and wired
// into AEE's hook installer (see src/hooks/index.ts).

import bcAeeModSdk from '@/modsdk';
import {installImagePatch} from './masking';
import {registerSingleGlove, reconcileSingleGlove} from './singleGlove';
import {registerFreeDrawGroups, installFreeDrawCallbacks, syncSlots, cacheDrawArgs} from './freeDraw';
import {installMaskTranslations} from './translations';

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

// After BC renders: cache draw args (for editor input mapping), reconcile the
// single glove, and keep each slot's canvas/vis companion in sync. The visible
// drawing itself is now a real BC layer, so we no longer paint it here.
function tryHookDrawCharacter(): boolean {
  if (drawHooked) return true;
  if (typeof DrawCharacter !== 'function') return false;
  bcAeeModSdk.hookFunction('DrawCharacter', 1, (args, next) => {
    const ret = next(args);
    const [C, X, Y, Zoom, IsHeightResizeAllowed] = args;
    cacheDrawArgs(C, X, Y, Zoom, IsHeightResizeAllowed);
    reconcileSingleGlove(C);
    syncSlots(C);
    return ret;
  });
  drawHooked = true;
  return true;
}

export function installMaskSystem() {
  if (started) return;
  started = true;

  installMaskTranslations(); // supply labels for our groups/assets/options


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
      console.log('[AEE Mask] 就緒：自由繪圖 ×3（真實圖層＋AEE 變換／遮罩切換）＋ 單手套 ×1');
    }
  }, 500);
}
