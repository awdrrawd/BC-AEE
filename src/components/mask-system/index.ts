// Mask system entry point: single glove + free-draw ×3 + shared masking.
// Ported from the standalone userscript 自由繪圖_合併單手套.user.js and wired
// into AEE's hook installer (see src/hooks/index.ts).

import bcAeeModSdk from '@/modsdk';
import {installImagePatch} from './masking';
import {registerSingleGlove, reconcileSingleGlove, applySingleGloveNames} from './singleGlove';
import {registerFreeDrawGroups, installFreeDrawCallbacks, syncSlots, cacheDrawArgs, renderOverlay, applyFreeDrawNames} from './freeDraw';
import {installMaskTranslations} from './translations';
import {SG_MASK_GROUP, DRAW_GROUPS} from './constants';

let started = false;
let drawHooked = false;
let sanitizeHooked = false;
let callbacksInstalled = false;

// Our group names — used to spot orphaned items (see healOrphans).
const OUR_GROUP_NAMES = new Set<string>([
  SG_MASK_GROUP as unknown as string,
  ...DRAW_GROUPS.map(g => g as unknown as string),
  ...DRAW_GROUPS.map(g => (g as unknown as string) + 'Mask'),
  ...DRAW_GROUPS.map(g => (g as unknown as string) + 'Vis'),
]);

// If BC rebuilt its asset list, a worn companion item can still point at OUR
// asset object which BC dropped from the global `Asset[]` (but kept in AssetMap /
// the group's Asset list). Iterating mods check `Asset.includes(item.Asset)`
// exactly (LSCG `smartGetAssetGroup`) → false → they read `orphan.Asset.Group`
// → crash. NOTE: `AssetGet()` still FINDS the orphan, so it can't detect this —
// we must check the global array itself. Our asset object is still valid, so we
// just re-link it into `Asset[]`; that makes `Asset.includes(a)` true again.
function healOrphans(C: Character | null) {
  if (!C || !Array.isArray(C.Appearance) || !Array.isArray(Asset)) return;
  for (const it of C.Appearance) {
    const a = it?.Asset;
    if (!a || !a.Group || !OUR_GROUP_NAMES.has(a.Group.Name)) continue;
    if (!Asset.includes(a)) Asset.push(a); // re-link orphaned OUR asset
  }
}

// Heal every character's appearance BEFORE other CommonDrawAppearanceBuild hooks
// (e.g. LSCG at priority 1) iterate it.
function tryHookSanitize(): boolean {
  if (sanitizeHooked) return true;
  if (typeof CommonDrawAppearanceBuild !== 'function') return false;
  bcAeeModSdk.hookFunction('CommonDrawAppearanceBuild', 8, (args, next) => {
    try { healOrphans(args[0]); } catch { /* never let healing break drawing */ }
    return next(args);
  });
  sanitizeHooked = true;
  return true;
}

function registerAll(): boolean {
  let ok = registerFreeDrawGroups();
  ok = registerSingleGlove() && ok;
  // Registration early-returns once the assets exist, so re-apply the display
  // names every pass — this relabels the menu after a UI-language switch.
  applyFreeDrawNames();
  applySingleGloveNames();
  return ok;
}

// After BC renders each character: cache draw args (editor input mapping),
// reconcile the single glove, keep the local player's board canvases in sync,
// and paint each character's own drawing overlay (per-character, so other AEE
// players see everyone's drawings).
function tryHookDrawCharacter(): boolean {
  if (drawHooked) return true;
  if (typeof DrawCharacter !== 'function') return false;
  bcAeeModSdk.hookFunction('DrawCharacter', 1, (args, next) => {
    const ret = next(args);
    // This runs every frame for every character. A throw in any of our
    // post-draw steps would propagate through the DrawCharacter hook chain and
    // crash the whole screen — swallow it so we can never take BC down.
    try {
      const [C, X, Y, Zoom, IsHeightResizeAllowed] = args;
      cacheDrawArgs(C, X, Y, Zoom, IsHeightResizeAllowed);
      reconcileSingleGlove(C);
      syncSlots(C);
      renderOverlay(C, X, Y, Zoom, IsHeightResizeAllowed);
    } catch (e) {
      console.error('[AEE Mask] DrawCharacter 後處理例外：', e);
    }
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
    tryHookSanitize();

    if (patch && registered && !callbacksInstalled) {
      callbacksInstalled = true;
      installFreeDrawCallbacks();
    }
    if (patch && registered && drawHooked && callbacksInstalled) {
      clearInterval(timer);
      // Heartbeat: if BC reloads its assets our runtime groups vanish while worn
      // items still reference the old (orphaned) asset objects — which crashes
      // other mods (e.g. LSCG). registerAll() is idempotent (asset-existence
      // guarded) and cheap, so re-run it periodically to self-heal.
      setInterval(() => { installImagePatch(); registerAll(); }, 4000);
    }
  }, 500);
}
