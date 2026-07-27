// Single glove: ONE typed item (SingleGloveFX/SingleGlove). The item menu shows
// 6 text-only options (L/R × {gloves, luzi/ECHO, both}); each carries SGSide /
// SGScope in its Property. Mask layers are destination-out with a TextureMask.

import {
  FAMILY, SG_MASK_GROUP, SG_ASSET, SG_PRIORITY, SG_SCOPES, SG_OPTIONS,
  SG_LAYER_KEY, type SGScope, type SGSide, type SGOption,
} from './constants';
import {SG_MASK_L_DATAURL, SG_MASK_R_DATAURL, SG_ITEM_DATAURL} from './assets';
import {MaskImageProviders, TRANSPARENT_DATAURL, bustMaskTexture, addPreviewRule, getBuildingChar} from './masking';

const SG_DATAURL: Record<SGSide, string> = {L: SG_MASK_L_DATAURL, R: SG_MASK_R_DATAURL};

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
    || (typeof CharacterGetCurrent === 'function' && CharacterGetCurrent())
    || (typeof Player !== 'undefined' ? Player : null);
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
  if (AssetGroupGet(FAMILY, SG_MASK_GROUP)) return true;

  const glovesGroup = AssetGroupGet(FAMILY, 'Gloves');
  const group = AssetGroupAdd(FAMILY, {
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

  // Display label (BC reads group/item names from `.Description`).
  const gg = AssetGroupGet(FAMILY, SG_MASK_GROUP);
  if (gg) (gg as unknown as {Description?: string}).Description = '單手套';
  const ga = AssetGet(FAMILY, SG_MASK_GROUP, SG_ASSET);
  if (ga) (ga as unknown as {Description?: string}).Description = '單手套';

  console.log('[AEE Mask] 已註冊單手套（typed：一個物件可選左右＋範圍）');
  return true;
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

// Console helpers.
export function singleGloveWear() { InventoryWear(Player, SG_ASSET, SG_MASK_GROUP); CharacterRefresh(Player, true, false); }
export function singleGloveClear() { InventoryRemove(Player, SG_MASK_GROUP); CharacterRefresh(Player, true, false); }
