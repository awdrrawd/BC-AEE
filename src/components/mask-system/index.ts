// Mask system entry point: single glove + free-draw ×3 + shared masking.
// Ported from the standalone userscript 自由繪圖_合併單手套.user.js and wired
// into AEE's hook installer (see src/hooks/index.ts).

import bcAeeModSdk from '@/modsdk';
import {installImagePatch, bustMaskTexture} from './masking';
import {registerSingleGlove, reconcileSingleGlove, applySingleGloveNames} from './singleGlove';
import {registerFreeDrawGroups, installFreeDrawCallbacks, syncSlots, cacheDrawArgs, renderOverlay, applyFreeDrawNames, setFreeDrawAvailability} from './freeDraw';
import {settings} from '@/core/settings';
import {installMaskTranslations} from './translations';
import {installPeerDetection, isAeeMember} from './peers';
import {
  SG_MASK_GROUP,
  SG_ASSET,
  DRAW_GROUPS,
  DRAW_ASSET,
  drawMaskGroupName,
  drawVisibleGroupName,
  MASK_INSTALL_RETRY_MS,
  MASK_SYNC_REPUSH_DELAY_MS,
} from './constants';

let started = false;
let drawHooked = false;
let sanitizeHooked = false;
let assetReloadHooked = false;
let appearanceSyncHooked = false;
let callbacksInstalled = false;

// Our group names — used to spot orphaned items (see healOrphans).
const OUR_GROUP_NAMES = new Set<string>([
  SG_MASK_GROUP as unknown as string,
  ...DRAW_GROUPS.map(g => g as unknown as string),
  ...DRAW_GROUPS.map(drawMaskGroupName),
  ...DRAW_GROUPS.map(drawVisibleGroupName),
]);

// Every [group, asset] pair we register — used to purge stale AssetMap/
// AssetGroupMap entries after a BC asset reload (see reRegisterAfterReload).
function ourAssetPairs(): [string, string][] {
  const pairs: [string, string][] = [[SG_MASK_GROUP as unknown as string, SG_ASSET]];
  for (const g of DRAW_GROUPS) {
    const gn = g as unknown as string;
    const maskGroup = drawMaskGroupName(gn);
    const visibleGroup = drawVisibleGroupName(gn);
    pairs.push([gn, DRAW_ASSET], [maskGroup, `${maskGroup}A`], [visibleGroup, `${visibleGroup}A`]);
  }
  return pairs;
}

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

// ECHO-style survival of a BC asset reload. AssetLoadAll() does `Asset = [];
// AssetGroup = []` and rebuilds ONLY BC's own assets from AssetFemale3DCG — our
// runtime groups vanish from the global arrays (so their wardrobe buttons
// disappear) yet linger in AssetMap/AssetGroupMap. Because registration's
// existence guards read those maps, they'd wrongly early-return and never re-add
// our groups. So on every reload: purge our stale map entries, then re-register
// from scratch → BC's fresh arrays contain our groups again and the menu is
// restored. (Worn items still point at the pre-reload asset objects; the
// CommonDrawAppearanceBuild heal keeps those rendering + crash-safe.)
function reRegisterAfterReload() {
  try {
    for (const name of OUR_GROUP_NAMES) AssetGroupMap.delete(name as unknown as AssetGroupName);
    for (const [g, a] of ourAssetPairs()) AssetMap.delete(`${g}/${a}` as `${AssetGroupName}/${string}`);
  } catch { /* ignore */ }
  try {
    registerAll();
    bustMaskTexture();
  } catch (e) {
    console.error('[AEE Mask] 資產重載後重新註冊失敗：', e);
  }
}

function tryHookAssetReload(): boolean {
  if (assetReloadHooked) return true;
  if (typeof AssetLoadAll !== 'function') return false;
  bcAeeModSdk.hookFunction('AssetLoadAll', 1, (args, next) => {
    const ret = next(args); // let BC finish rebuilding first
    reRegisterAfterReload();
    return ret;
  });
  assetReloadHooked = true;
  return true;
}

// Preserve OUR custom items when a NON-AEE member changes a plugin user's
// clothing. BC drops any bundled item whose asset the sender's client can't
// resolve (ServerBundledItemToAppearanceItem → null), so a full-appearance push
// from someone without AEE arrives missing our ItemCanvas*/SingleGloveFX items,
// and ServerAppearanceLoadFromBundle rebuilds C.Appearance without them → the
// drawings/masks vanish for everyone. (ECHO items survive because that editor
// still has ECHO; only OUR groups get stripped.) Per-item edits go through a
// different path that only touches the one group, so this is specific to full
// pushes. Fix, entirely on the AEE user's own client: snapshot our items before
// the bundle is applied and, when the update came from SOMEONE ELSE, re-add any
// of our items the bundle dropped. Guarded to foreign sources so the wearer can
// still remove their own drawings normally (self-sync keeps them anyway).
const preserveRepushPending = new Set<number>();

function preserveOurItemsAfterSync(C: Character, sourceMember: number, before: Item[]) {
  const list = C.Appearance;
  if (!Array.isArray(list)) return;
  let restored = false;
  for (const it of before) {
    const gname = it?.Asset?.Group?.Name;
    if (!gname) continue;
    if (!list.some(x => x?.Asset?.Group?.Name === gname)) { list.push(it); restored = true; }
  }
  if (!restored) return;
  // On the wearer, re-broadcast so the non-AEE editor's strip doesn't persist to
  // the server / future joiners. The re-push carries the editor's legitimate
  // change AND our restored items. Debounced per character; not a loop — a
  // non-AEE receiver just re-drops them locally without re-pushing.
  const isPlayer = typeof C.IsPlayer === 'function' ? C.IsPlayer() : false;
  const mn = C.MemberNumber;
  const inRoom = typeof ServerPlayerIsInChatRoom === 'function' && ServerPlayerIsInChatRoom();
  if (isPlayer && inRoom && mn != null && sourceMember !== mn && !preserveRepushPending.has(mn)) {
    preserveRepushPending.add(mn);
    setTimeout(() => {
      preserveRepushPending.delete(mn);
      try { if (typeof ChatRoomCharacterUpdate === 'function') ChatRoomCharacterUpdate(C); } catch { /* ignore */ }
    }, MASK_SYNC_REPUSH_DELAY_MS);
  }
}

function tryHookAppearanceSync(): boolean {
  if (appearanceSyncHooked) return true;
  if (typeof ServerAppearanceLoadFromBundle !== 'function') return false;
  bcAeeModSdk.hookFunction('ServerAppearanceLoadFromBundle', 5, (args, next) => {
    const C = args[0] as Character | undefined;
    const sourceMember = args[3] as number | null | undefined;
    const appearanceFull = !!args[4];
    let before: Item[] = [];
    try {
      // Only the non-full path rebuilds C.Appearance. Restore our dropped items
      // ONLY when the change came from a NON-AEE client: such a client cannot
      // serialize our custom assets, so a missing group is an accidental strip we
      // must undo. When the sender IS running AEE, any group it omits was removed
      // ON PURPOSE (e.g. A takes off B's drawing) and must stay removed — this is
      // how ECHO gates it too (CharacterTag). Deliberate removals also reach us
      // first via the per-item ChatRoomSyncItem path (which bypasses this hook),
      // so by the time a later full sync arrives the item is already gone from
      // C.Appearance → `before` is empty → nothing is wrongly re-added.
      //
      // No `sourceMember !== C.MemberNumber` guard: a non-AEE wearer pushing their
      // OWN appearance (dressing themselves) is exactly the strip we want to undo,
      // and there the source IS the wearer.
      if (C && !appearanceFull && !isAeeMember(sourceMember) && Array.isArray(C.Appearance)
        && sourceMember != null && C.MemberNumber != null) {
        before = C.Appearance.filter(it => {
          const n = it?.Asset?.Group?.Name;
          return typeof n === 'string' && OUR_GROUP_NAMES.has(n);
        });
      }
    } catch { /* ignore */ }
    const ret = next(args);
    if (before.length && C && sourceMember != null) {
      try { preserveOurItemsAfterSync(C, sourceMember, before); }
      catch (e) { console.error('[AEE Mask] 外部換裝保留自訂物品失敗：', e); }
    }
    return ret;
  });
  appearanceSyncHooked = true;
  return true;
}

function registerAll(): boolean {
  const freeDrawEnabled = settings.enableFreeDraw.get();
  let ok = freeDrawEnabled ? registerFreeDrawGroups() : true;
  setFreeDrawAvailability(freeDrawEnabled);
  ok = registerSingleGlove() && ok;
  // Registration early-returns once the assets exist, so re-apply the display
  // names every pass — this relabels the menu after a UI-language switch.
  if (freeDrawEnabled) applyFreeDrawNames();
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
      if (settings.enableFreeDraw.get()) {
        syncSlots(C);
        renderOverlay(C);
      }
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

  settings.enableFreeDraw.onChange(enabled => {
    if (enabled) registerFreeDrawGroups();
    setFreeDrawAvailability(enabled);
    try {
      if (typeof CharacterLoadCanvas === 'function') {
        CharacterLoadCanvas(Player);
        for (const C of ChatRoomCharacter ?? []) CharacterLoadCanvas(C);
      }
    } catch { /* character lists are not always ready on login */ }
  });


  // BC assets / draw functions may not be ready the instant the bundle loads;
  // retry until image patch + registration + hook are all in place.
  const timer = setInterval(() => {
    const patch = installImagePatch();
    const registered = registerAll();
    tryHookDrawCharacter();
    tryHookSanitize();
    tryHookAssetReload();
    tryHookAppearanceSync();
    const peerDetectionReady = installPeerDetection(); // idempotent; learns which room members run AEE

    if (patch && registered && !callbacksInstalled) {
      callbacksInstalled = true;
      installFreeDrawCallbacks();
    }
    if (patch && registered && drawHooked && sanitizeHooked && callbacksInstalled
      && assetReloadHooked && appearanceSyncHooked && peerDetectionReady) {
      clearInterval(timer);
    }
  }, MASK_INSTALL_RETRY_MS);
}
