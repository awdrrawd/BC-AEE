// Asset registration: registers each slot's DrawingBoard, hidden mask
// companion, and (VIS_SLOTS only) visible-drawing companion with BC's asset
// system, plus the language-relabel heartbeat entry point.

import {
  FAMILY, DRAW_ASSET, SLOT_COUNT, DRAW_GROUPS, VIS_SLOTS,
  MASK_TARGET_GROUPS, MASK_PRIORITY, MASK_APPLY_TO_ABOVE, DRAW_VIS_PRIORITY,
} from '../constants';
import {maskLabel} from '../translations';
import {slots} from './slots';

function getMaskTargetGroups(): string[] {
  return MASK_TARGET_GROUPS.filter(n => !AssetGroupMap || AssetGroupMap.has(n));
}

// True once the asset actually exists in its group (survives BC asset reloads:
// if AssetAdd failed/was wiped, this stays false so we re-register).
function assetExists(group: AssetGroupName, name: string): boolean {
  const g = AssetGroupGet(FAMILY, group);
  const list = (g as unknown as {Asset?: {Name: string}[]} | null)?.Asset;
  return !!(Array.isArray(list) && list.some(a => a.Name === name));
}
function safeAssetAdd(group: AssetGroup, def: unknown, cfg: unknown, groupDef: unknown) {
  try {
    AssetAdd(group, def as AssetDefinition, cfg as ExtendedItemMainConfig, groupDef as AssetGroupDefinition);
  } catch (e) {
    console.error('[AEE Mask] AssetAdd 失敗：', e);
  }
}

// BC shows group/item names from `.Description` (AssetAdd overwrites it with the
// Name), so set the displayed labels on the registered group + asset objects.
function setDesc(group: AssetGroupName, assetName: string, label: string) {
  const g = AssetGroupGet(FAMILY, group);
  if (g) (g as unknown as {Description?: string}).Description = label;
  const a = AssetGet(FAMILY, group, assetName);
  if (a) (a as unknown as {Description?: string}).Description = label;
}

function registerDrawGroup(i: number): boolean {
  const g = DRAW_GROUPS[i];
  const slot = slots[i];
  if (assetExists(g, DRAW_ASSET)) return true;

  const group = AssetGroupGet(FAMILY, g) ?? AssetGroupAdd(FAMILY, {
    Group: g, Category: 'Appearance', AllowNone: true, Random: false, Clothing: true,
  } as unknown as AssetGroupDefinition);

  const removeOnRemove = [{Group: slot.maskGroup, Name: slot.maskAsset}];
  if (VIS_SLOTS.has(i)) removeOnRemove.push({Group: slot.visGroup, Name: slot.visAsset});
  safeAssetAdd(group, {
    Name: DRAW_ASSET,
    Value: 0, Wear: true, Extended: true, AlwaysInteract: true, Random: false,
    RemoveItemOnRemove: removeOnRemove,
  }, {}, {Group: g});
  setDesc(g, DRAW_ASSET, maskLabel('mask-free-draw-name', {n: i + 1}));
  return assetExists(g, DRAW_ASSET);
}

// Re-apply the free-draw board labels from the current UI language (BC reads
// menu names from `.Description`). Called on the heartbeat so switching language
// relabels the three boards. The hidden mask/vis companions stay as-is (they
// have AllowCustomize:false → no menu button).
export function applyFreeDrawNames() {
  for (let i = 0; i < SLOT_COUNT; i++) setDesc(DRAW_GROUPS[i], DRAW_ASSET, maskLabel('mask-free-draw-name', {n: i + 1}));
}

// Visible-drawing companion: a real layer with DynamicAfterDraw, so BC calls our
// AfterDraw callback during THIS layer's draw → we paint the character's own
// drawing at the layer's z-position (layer-orderable + per-character). TEST: only
// registered for VIS_SLOTS. HasImage:false → no image URL, only the AfterDraw.
function registerVisGroup(i: number): boolean {
  const slot = slots[i];
  if (assetExists(slot.visGroup, slot.visAsset)) return true;

  const group = AssetGroupGet(FAMILY, slot.visGroup) ?? AssetGroupAdd(FAMILY, {
    Group: slot.visGroup, Category: 'Appearance', Clothing: true, AllowNone: true, Random: false,
    AllowCustomize: false, Priority: DRAW_VIS_PRIORITY,
  } as unknown as AssetGroupDefinition);

  safeAssetAdd(group, {
    Name: slot.visAsset,
    Description: `自由繪圖 ${i + 1}（顯示）`,
    DynamicAfterDraw: true,
    Layer: [{HasImage: false, Priority: DRAW_VIS_PRIORITY}],
  }, null, {Group: slot.visGroup, Category: 'Appearance', Clothing: true, AllowNone: true});
  setDesc(slot.visGroup, slot.visAsset, `自由繪圖${i + 1}顯示`);
  return assetExists(slot.visGroup, slot.visAsset);
}

function registerMaskGroup(i: number): boolean {
  const slot = slots[i];
  if (assetExists(slot.maskGroup, slot.maskAsset)) return true;

  const group = AssetGroupGet(FAMILY, slot.maskGroup) ?? AssetGroupAdd(FAMILY, {
    Group: slot.maskGroup, Category: 'Appearance', Clothing: true, AllowNone: true, Random: false,
    AllowCustomize: false, Priority: MASK_PRIORITY,
  } as unknown as AssetGroupDefinition);

  safeAssetAdd(group, {
    Name: slot.maskAsset,
    Description: `繪圖遮罩 ${i + 1}（隱藏身體以外）`,
    Layer: [{
      HasImage: false,
      BlendingMode: 'destination-out',
      Priority: MASK_PRIORITY,
      TextureMask: {Groups: getMaskTargetGroups(), ApplyToAbove: MASK_APPLY_TO_ABOVE},
    }],
  }, null, {Group: slot.maskGroup, Category: 'Appearance', Clothing: true, AllowNone: true});
  setDesc(slot.maskGroup, slot.maskAsset, `繪圖遮罩${i + 1}`);
  return assetExists(slot.maskGroup, slot.maskAsset);
}

export function registerFreeDrawGroups(): boolean {
  if (typeof AssetGroupAdd !== 'function' || typeof AssetAdd !== 'function') return false;
  let ok = true;
  for (let i = 0; i < SLOT_COUNT; i++) ok = registerDrawGroup(i) && ok;
  for (let i = 0; i < SLOT_COUNT; i++) ok = registerMaskGroup(i) && ok;
  for (const i of VIS_SLOTS) ok = registerVisGroup(i) && ok;
  return ok;
}
