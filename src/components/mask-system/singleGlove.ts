// Single glove: ONE typed item (SingleGloveFX/SingleGlove). The item menu shows
// 6 text-only options (L/R × {gloves, luzi/ECHO, both}); each carries SGSide /
// SGScope in its Property. Mask layers are destination-out with a TextureMask.

import {
  FAMILY, SG_MASK_GROUP, SG_ASSET, SG_PRIORITY, SG_SCOPES, SG_OPTIONS,
  SG_LAYER_KEY, type SGScope, type SGSide, type SGOption,
} from './constants';
import {SG_MASK_DATAURL, SG_ITEM_DATAURL} from './assets';
import {MaskImageProviders, TRANSPARENT_DATAURL, bustMaskTexture, addPreviewRule, getBuildingChar} from './masking';
import {maskLabel} from './translations';
import {safeCurrentCharacter} from './freeDraw/currentCharacter';

// The glove mask ships as ONE 1000x1000 image: right hand occupies x 0..500,
// left hand x 500..1000 (full height). BC's TextureMask expects a body-sized
// 500x1000 image, so crop each half into its own 500x1000 data URL at runtime.
// Cropping needs the source decoded (async); until ready the provider returns a
// transparent pixel, then we bust + reload so the mask appears.
const MASK_IMG_W = 500, MASK_IMG_H = 1000;
const SG_DATAURL: Partial<Record<SGSide, string>> = {};
let cropStarted = false;
const MASK_CROP_MAX_ATTEMPTS = 3;
const MASK_CROP_RETRY_DELAY_MS = 1500; // backs off: 1.5s, 3s

// The source is a same-origin data: URL (SG_MASK_DATAURL, bundled at build
// time), so a load failure here isn't a transient network hiccup — it means
// the decode itself failed (e.g. a momentarily starved browser image decoder).
// Without a retry, that one failure would leave the glove mask permanently
// transparent for the rest of the session (nothing else ever re-triggers this).
function ensureMaskCrops(attempt = 1) {
  if (cropStarted) return;
  cropStarted = true;
  const img = new Image();
  img.addEventListener('load', () => {
    const sxForSide: Record<SGSide, number> = {R: 0, L: MASK_IMG_W}; // R=0..500, L=500..1000
    for (const side of ['R', 'L'] as SGSide[]) {
      try {
        const c = document.createElement('canvas');
        c.width = MASK_IMG_W;
        c.height = MASK_IMG_H;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(img, sxForSide[side], 0, MASK_IMG_W, MASK_IMG_H, 0, 0, MASK_IMG_W, MASK_IMG_H);
        SG_DATAURL[side] = c.toDataURL('image/png');
      } catch (e) {
        console.error('[AEE Mask] 單手套遮罩裁切失敗：', e);
      }
    }
    // Crops are ready → drop the (transparent) cached mask texture and rebuild.
    bustMaskTexture();
    if (typeof CharacterLoadCanvas === 'function') {
      const C = safeCurrentCharacter();
      if (C) setTimeout(() => { try { CharacterLoadCanvas(C); } catch { /* ignore */ } }, 0);
    }
  });
  img.addEventListener('error', () => {
    console.error(`[AEE Mask] 單手套遮罩來源載入失敗（第 ${attempt}/${MASK_CROP_MAX_ATTEMPTS} 次）`);
    if (attempt >= MASK_CROP_MAX_ATTEMPTS) {
      console.error('[AEE Mask] 單手套遮罩來源多次載入失敗，已放棄重試；此次會話中該遮罩會維持透明。');
      return;
    }
    cropStarted = false;
    setTimeout(() => ensureMaskCrops(attempt + 1), MASK_CROP_RETRY_DELAY_MS * attempt);
  });
  img.src = SG_MASK_DATAURL;
}
ensureMaskCrops();

// Show the glove picture for the base item thumbnail only (URL ends with the
// bare asset name); the per-option preview URLs carry the option name suffix
// and are left un-injected so those buttons stay text-only.
addPreviewRule({
  match: (src) => src.includes(SG_MASK_GROUP) && /[/\\]SingleGlove\.png$/.test(src),
  url: () => SG_ITEM_DATAURL,
});

function readSelection(item: Item | null | undefined): SGOption | null {
  if (!item || !item.Property) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prop = item.Property as any;
  // Preferred: each option carries SGSide/SGScope (no reliance on TypeRecord key format).
  if (prop.SGSide && prop.SGScope) return {side: prop.SGSide, scope: prop.SGScope, Name: ''};
  const tr = prop.TypeRecord as Record<string, number> | undefined;
  const idx = (tr ? (Object.values(tr)[0] || 0) : (Number(prop.Type) || 0)) as number;
  return SG_OPTIONS[idx] || SG_OPTIONS[0];
}

function selectedOption(): SGOption | null {
  // During a GL build, use the character being built (so remote players show
  // THEIR own glove); otherwise fall back to the current/edited character.
  const C = getBuildingChar()
    || safeCurrentCharacter();
  return readSelection(C ? InventoryGet(C, SG_MASK_GROUP) : null);
}

// Register one mask-image provider per scope; returns the L/R image only when
// the current selection matches that scope, otherwise a transparent pixel.
(Object.keys(SG_LAYER_KEY) as SGScope[]).forEach((scope) => {
  MaskImageProviders[SG_LAYER_KEY[scope]] = () => {
    const opt = selectedOption();
    if (!opt || opt.scope !== scope) return TRANSPARENT_DATAURL;
    return SG_DATAURL[opt.side] || TRANSPARENT_DATAURL;
  };
});

export function registerSingleGlove(): boolean {
  if (typeof AssetGroupGet !== 'function' || typeof AssetGroupAdd !== 'function') return false;
  // Guard on the ASSET, not the group. Guarding on the group meant that if
  // AssetGroupAdd succeeded but the later AssetAdd failed (or a reload wiped the
  // asset but left the group in the map), the group existed with no usable item
  // and was NEVER retried → single glove permanently broken. Also reuse an
  // existing group object (?? AssetGroupAdd) so a retry can't push a duplicate.
  if (AssetGet(FAMILY, SG_MASK_GROUP, SG_ASSET)) return true;

  try {
    const glovesGroup = AssetGroupGet(FAMILY, 'Gloves');
    const group = AssetGroupGet(FAMILY, SG_MASK_GROUP) ?? AssetGroupAdd(FAMILY, {
      Group: SG_MASK_GROUP,
      Category: 'Appearance',
      Clothing: true,
      AllowNone: true,
      Random: false,
      Zone: glovesGroup ? glovesGroup.Zone : [],
      ParentSize: glovesGroup ? glovesGroup.ParentSize : undefined,
      Priority: SG_PRIORITY,
    } as unknown as AssetGroupDefinition);

    const mkLayer = (scope: SGScope) => ({
      Name: SG_LAYER_KEY[scope],
      HasImage: false,
      BlendingMode: 'destination-out',
      Priority: SG_PRIORITY,
      TextureMask: {Groups: SG_SCOPES[scope].groups, ApplyToAbove: true},
    });

    const groupDef = {Group: SG_MASK_GROUP, Category: 'Appearance', Clothing: true, AllowNone: true};
    const extendedConfig = {
      [SG_MASK_GROUP]: {
        [SG_ASSET]: {
          Archetype: 'typed',
          // Each option carries SGSide/SGScope → written straight into item.Property.
          Options: SG_OPTIONS.map(o => ({Name: o.Name, Property: {SGSide: o.side, SGScope: o.scope}})),
        },
      },
    };

    AssetAdd(group, {
      Name: SG_ASSET,
      Description: '單手套（可選左右＋範圍）',
      Extended: true,
      Layer: [mkLayer('gloves'), mkLayer('luzi'), mkLayer('both')],
    } as unknown as AssetDefinition, extendedConfig as unknown as ExtendedItemMainConfig, groupDef as unknown as AssetGroupDefinition);
  } catch (e) {
    console.error('[AEE Mask] 單手套註冊失敗：', e);
    return false; // leave the guard false so the heartbeat retries
  }

  applySingleGloveNames();
  return !!AssetGet(FAMILY, SG_MASK_GROUP, SG_ASSET);
}

// Set the group/asset display label from the current UI language (BC reads
// group/item names from `.Description`). Re-run on the heartbeat so switching
// language relabels the menu.
export function applySingleGloveNames() {
  if (typeof AssetGroupGet !== 'function') return;
  const label = maskLabel('mask-single-glove-name');
  const gg = AssetGroupGet(FAMILY, SG_MASK_GROUP);
  if (gg) (gg as unknown as {Description?: string}).Description = label;
  const ga = AssetGet(FAMILY, SG_MASK_GROUP, SG_ASSET);
  if (ga) (ga as unknown as {Description?: string}).Description = label;
}

// On typed-option change, bust the mask texture so the hand/scope actually swaps.
const lastSig = new Map<number | Character, string>();
export function reconcileSingleGlove(C: Character | null) {
  if (!C) return;
  const item = InventoryGet(C, SG_MASK_GROUP);
  const sel = readSelection(item);
  const sig = sel ? (sel.side + '/' + sel.scope) : 'none';
  const key = C.MemberNumber != null ? C.MemberNumber : C;
  if (lastSig.get(key) === sig) return;
  lastSig.set(key, sig);
  bustMaskTexture();
  if (typeof CharacterLoadCanvas === 'function') {
    setTimeout(() => { try { CharacterLoadCanvas(C); } catch { /* ignore */ } }, 0);
  }
}
