import type {AeeLayerOverride, CanvasRect, LayerId, LayerOverrideKey, LayerPositionOverride} from '@/core/types';
import {runtime} from '@/core/runtime';

export const LOCKED_GROUPS = new Set(['BodyUpper', 'BodyLower', 'Nipples', 'Pussy', 'Head']);

export function getCanvas(): HTMLCanvasElement | null {
  return (document.getElementById('MainCanvas') as HTMLCanvasElement | null) || document.querySelector('canvas');
}

export function getCanvasRect(): CanvasRect | null {
  const canvas = getCanvas();
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
  };
}

export function getCurrentItem(): Item | null {
  if (CharacterAppearanceMode === 'Color' && CharacterAppearanceSelection && CharacterAppearanceColorPickerGroupName) {
    return InventoryGet(CharacterAppearanceSelection, CharacterAppearanceColorPickerGroupName) ?? null;
  }
  return runtime.itemColorItem ?? null;
}

export function getCurrentGroup(): string | null {
  if (typeof CharacterAppearanceColorPickerGroupName !== 'undefined' && CharacterAppearanceColorPickerGroupName) return CharacterAppearanceColorPickerGroupName;
  if (runtime.itemColorItem) return runtime.itemColorItem.Asset?.Group?.Name || null;
  return null;
}

export function getCurrentCharacter(): Character | null {
  return CharacterAppearanceSelection || runtime.itemColorChar || null;
}

export function getAppearanceMode(): string | null {
  return typeof CharacterAppearanceMode !== 'undefined' ? CharacterAppearanceMode : null;
}

export function isEditableAppearanceContext() {
  const item = getCurrentItem();
  const group = getCurrentGroup();
  const mode = getAppearanceMode();
  const wardrobeColor = mode === 'Color';
  const itemColor = !!runtime.itemColorItem;
  return !!item && !!group && (wardrobeColor || itemColor);
}

export function ensureLayerOverrides(item: Item | null) {
  if (!item) return;
  if (!item.Property) item.Property = {};
  const count = item.Asset?.Layer?.length || 1;
  if (!Array.isArray(item.Property.LayerOverrides)) {
    item.Property.LayerOverrides = Array.from({length: count}, () => ({}));
  }
  while (item.Property.LayerOverrides.length < count) item.Property.LayerOverrides.push({});
}

export function ensureOpacityArray(item: Item | null) {
  if (!item) return;
  if (!item.Property) item.Property = {};
  const layerCount = item.Asset?.Layer?.length || 1;
  if (!Array.isArray(item.Property.Opacity) || item.Property.Opacity.length !== layerCount) {
    const existing = item.Property.Opacity;
    const base = typeof existing === 'number' ? existing : 1;
    item.Property.Opacity = Array(layerCount).fill(base);
  }
}

export function setLayerOverride(item: Item, layerIdx: LayerId, key: LayerOverrideKey, value: AeeLayerOverride[LayerOverrideKey]) {
  ensureLayerOverrides(item);
  const count = item.Asset?.Layer?.length || 1;
  // Apply to every layer of the selected part (anchor + its CopyLayerColor
  // copies/variants) so the visible layer moves even when the base is empty.
  const indices = layerIdx === 'all' ? Array.from({length: count}, (_, index) => index) : getLayerGroupMembers(item, parseInt(layerIdx, 10));
  if (runtime.itemColorChar) runtime.itemColorDirty = true;

  if (key === 'Opacity') {
    ensureOpacityArray(item);
    indices.forEach(index => {
      const layer = item.Asset?.Layer?.[index];
      const rawOpacity = typeof value === 'number' ? value : 1;
      const clamped = Math.min(Math.max(rawOpacity, layer?.MinOpacity ?? 0), layer?.MaxOpacity ?? 1);
      if (!item.Property.LayerOverrides[index]) item.Property.LayerOverrides[index] = {};
      item.Property.LayerOverrides[index].Opacity = clamped;
      const opacityArray = item.Property.Opacity;
      if (Array.isArray(opacityArray) && index < opacityArray.length) opacityArray[index] = clamped;
    });
    const character = getCurrentCharacter();
    if (character) {
      try {
        CharacterLoadCanvas(character);
      } catch {
        // BC canvas refresh failures should not break the UI.
      }
    }
    return;
  }

  indices.forEach(index => {
    if (!item.Property.LayerOverrides[index]) item.Property.LayerOverrides[index] = {};
    item.Property.LayerOverrides[index][key] = value as never;
  });
  refreshCurrentCharacter(false);
  // While editing a restraint's colour (the ItemColor screen) CharacterRefresh
  // alone does not rebuild the cached layer canvas, so transform changes such as
  // scale/skew only appear after saving. Force a canvas reload on the item-color
  // character to make the update show in real time.
  if (runtime.itemColorChar) {
    runtime.itemColorDirty = true;
    try {
      CharacterLoadCanvas(runtime.itemColorChar);
    } catch {
      // BC canvas refresh failures should not break the UI.
    }
  }
}

export function refreshCurrentCharacter(loadCanvas = false) {
  const character = getCurrentCharacter();
  if (!character) return;
  try {
    if (loadCanvas) CharacterLoadCanvas(character);
    else CharacterRefresh(character, false, false);
  } catch {
    // Refresh can fail while BC is changing screens.
  }
}

export function getOpacity(item: Item | null, idx: LayerId): number | null {
  if (!item) return null;
  if (idx === 'all') {
    const count = item?.Asset?.Layer?.length || 1;
    let commonValue: number | null = null;
    for (let index = 0; index < count; index++) {
      const layerOverride = item?.Property?.LayerOverrides?.[index];
      const value = layerOverride?.Opacity ?? (Array.isArray(item.Property?.Opacity) ? item.Property.Opacity[index] : 1) ?? 1;
      if (index === 0) commonValue = value;
      else if (Math.abs(value - commonValue!) > 0.005) return null;
    }
    return commonValue;
  }
  const index = parseInt(idx, 10);
  const layerOverride = item?.Property?.LayerOverrides?.[index];
  if (layerOverride?.Opacity != null) return layerOverride.Opacity;
  const rawOpacity = item?.Property?.Opacity;
  return Array.isArray(rawOpacity) ? rawOpacity[index] : (typeof rawOpacity === 'number' ? rawOpacity : 1);
}

export function getLayerOverride(item: Item | null, idx: LayerId): AeeLayerOverride & { Opacity: number } {
  const index = idx === 'all' ? 0 : parseInt(idx, 10);
  const layerOverride = item?.Property?.LayerOverrides?.[index] || {};
  const opacity = getOpacity(item, idx) ?? 1;
  return {...layerOverride, Opacity: opacity};
}

function isUsableLayerLabel(text: string | undefined | null, key: string): text is string {
  return !!text && !text.startsWith('MISSING') && text !== key;
}

function assetTextPrefix(asset: Asset): string {
  return (asset.DynamicGroupName ?? '') + (asset.Name ?? '');
}

// The friendly name BC shows for a single colour group (e.g. "外側"). Multi-layer
// groups live in ColorGroups.csv, single-layer groups in LayerNames.csv - exactly
// as BC's ItemColorDrawColorPickerHeader does.
function resolveColorGroupLabel(asset: Asset, group: ColorGroup): string {
  const key = assetTextPrefix(asset) + group.name;
  const cache = group.layers.length === 1 ? ItemColorLayerNames : ItemColorGroupNames;
  const text = cache?.get(key);
  return isUsableLayerLabel(text, key) ? text : (group.name ?? '');
}

// The friendly per-layer name (LayerNames.csv), falling back to the raw layer name.
function resolveLayerLabel(asset: Asset, layer: AssetLayer): string {
  const key = assetTextPrefix(asset) + (layer.Name ?? '');
  const text = ItemColorLayerNames?.get(key);
  return isUsableLayerLabel(text, key) ? text : (layer.Name ?? '');
}

// Read the name straight from BC's live colour-picker state. This is the exact
// grouping/naming BC used to render the colour list (works for modded assets too,
// since the mod already populated ItemColorState/TextCache at runtime). AEE lists
// each layer individually, so for multi-layer groups we keep the group name and
// append the layer name to stay distinguishable - matching BC's own
// "<group>: <layer>" convention when paging through a group's layers.
function getNameFromItemColorState(layer: AssetLayer): string | null {
  try {
    const state = typeof ItemColorState !== 'undefined' ? ItemColorState : null;
    const item = typeof ItemColorItem !== 'undefined' ? ItemColorItem : null;
    if (!state?.colorGroups || !item?.Asset) return null;
    const group = state.colorGroups.find(candidate => candidate.name !== null && candidate.layers.includes(layer));
    if (!group) return null;
    const groupLabel = resolveColorGroupLabel(item.Asset, group);
    if (group.layers.length <= 1) return groupLabel || null;
    const layerLabel = resolveLayerLabel(item.Asset, layer);
    return layerLabel ? `${groupLabel}: ${layerLabel}` : (groupLabel || null);
  } catch {
    return null;
  }
}

export function getLayerDisplayName(layer: AssetLayer | null | undefined, index: number | string) {
  if (!layer) return `Layer ${index}`;

  const fromState = getNameFromItemColorState(layer);
  if (fromState) return fromState;

  try {
    const asset = layer.Asset;
    if (asset && (ItemColorLayerNames || ItemColorGroupNames)) {
      const prefix = assetTextPrefix(asset);
      // Fallback for when BC's ItemColorState isn't available (e.g. the wardrobe
      // "Color" mode). Recompute the grouping the same way BC does: group by
      // ColorGroup (or the layer name), then look up the friendly label.
      const groupKey = layer.ColorGroup || layer.Name || '';
      const colorable = (asset.Layer ?? []).filter(l => !l.CopyLayerColor && l.AllowColorize && !l.HideColoring);
      const groupSize = colorable.filter(l => (l.ColorGroup || l.Name || '') === groupKey).length;
      const groupCache = groupSize > 1 ? ItemColorGroupNames : ItemColorLayerNames;
      const fromGroup = groupCache?.get(prefix + groupKey);
      if (isUsableLayerLabel(fromGroup, prefix + groupKey)) {
        if (groupSize <= 1) return fromGroup;
        const layerLabel = resolveLayerLabel(asset, layer);
        return layerLabel ? `${fromGroup}: ${layerLabel}` : fromGroup;
      }
      const layerKey = prefix + (layer.Name ?? '');
      const fromLayer = ItemColorLayerNames?.get(layerKey);
      if (isUsableLayerLabel(fromLayer, layerKey)) return fromLayer;
    }
  } catch {
    // Fall back to layer.Name below.
  }
  return layer.Name || `Layer ${index}`;
}

// Layers that share a base belong to one editable "part". BC links them with
// CopyLayerColor: a base/anchor layer (no CopyLayerColor) plus copy layers whose
// CopyLayerColor points at the base's Name (visual halves, style variants, etc).
// Grouping on `CopyLayerColor || Name` collapses each part to a single key, so a
// normal independent layer (no copies) is simply its own group.
function layerGroupKey(layer: AssetLayer | undefined | null): string {
  if (!layer) return '';
  return layer.CopyLayerColor || layer.Name || '';
}

// All layer indices belonging to the same part as the given layer.
export function getLayerGroupMembers(item: Item | null, layerIndex: number): number[] {
  const layers = item?.Asset?.Layer ?? [];
  const key = layerGroupKey(layers[layerIndex]);
  if (!key) return [layerIndex];
  const members: number[] = [];
  layers.forEach((layer, index) => {
    if (layerGroupKey(layer) === key) members.push(index);
  });
  return members.length ? members : [layerIndex];
}

// One row per editable part: the representative (anchor) layer index and its name.
// Used by the parts/opacity/layers lists so we no longer show every raw layer
// (anchor + copies + variants), which produced duplicate and English-only names.
export function getEditableParts(item: Item | null): {layerId: string; name: string}[] {
  const layers = item?.Asset?.Layer ?? [];
  const parts: {layerId: string; name: string}[] = [];
  const seen = new Set<string>();
  layers.forEach((layer, index) => {
    const key = layerGroupKey(layer);
    if (!key) {
      parts.push({layerId: String(index), name: getLayerDisplayName(layer, index)});
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    // Prefer the base layer (Name === key, no CopyLayerColor) as the row so the
    // colourable layer's resolved name and index represent the part.
    let repIndex = layers.findIndex(candidate => (candidate.Name ?? '') === key && !candidate.CopyLayerColor);
    if (repIndex < 0) repIndex = index;
    parts.push({layerId: String(repIndex), name: getLayerDisplayName(layers[repIndex], repIndex)});
  });
  return parts;
}

// BC stores colours per ColorIndex (item.Color[ColorIndex]), not per layer index.
// Several layers can share a ColorIndex, and layer index != ColorIndex in general,
// so colour lookups must go through the layer's ColorIndex.
function getColorIndicesForPart(item: Item, layerIdx: string): number[] {
  const layers = item.Asset?.Layer ?? [];
  const indices = new Set<number>();
  getLayerGroupMembers(item, parseInt(layerIdx, 10)).forEach(memberIndex => {
    const colorIndex = layers[memberIndex]?.ColorIndex;
    indices.add(typeof colorIndex === 'number' ? colorIndex : memberIndex);
  });
  return [...indices];
}

export function getLayerColor(item: Item | null, layerIdx: LayerId): string | null {
  if (!item) return null;
  const colors = item.Property?.Color ?? item.Color;
  if (!colors) return null;
  if (!Array.isArray(colors)) return typeof colors === 'string' ? colors : null;
  if (layerIdx === 'all') return colors[0] ?? null;
  const colorIndex = getColorIndicesForPart(item, layerIdx)[0] ?? 0;
  return colors[colorIndex] ?? colors[0] ?? null;
}

export function setLayerColor(item: Item | null, layerIdx: LayerId, hexColor: string) {
  if (!item) return;
  const count = item.Asset?.Layer?.length || 1;
  if (!item.Property) item.Property = {};
  const color = hexColor as BCColor;

  const initColorArray = (source: BCColor | BCColor[] | undefined) => {
    if (Array.isArray(source)) return source.slice();
    const base = typeof source === 'string' ? source : '#FFFFFF';
    return Array.from({length: count}, () => base);
  };

  if (!Array.isArray(item.Property.Color)) item.Property.Color = initColorArray(item.Property.Color ?? item.Color);
  if (!Array.isArray(item.Color)) item.Color = initColorArray(item.Color);

  const colorIndices = layerIdx === 'all'
    ? Array.from({length: count}, (_, i) => i)
    : getColorIndicesForPart(item, layerIdx);

  colorIndices.forEach(colorIndex => {
    while (item.Property.Color!.length <= colorIndex) (item.Property.Color as BCColor[]).push('#FFFFFF');
    while ((item.Color as BCColor[]).length <= colorIndex) (item.Color as BCColor[]).push('#FFFFFF');
    (item.Property.Color as BCColor[])[colorIndex] = color;
    (item.Color as BCColor[])[colorIndex] = color;
  });
  refreshCurrentCharacter(false);
}

export function getAssetBaseXY(item: Item, layerIdx: LayerId) {
  const index = layerIdx === 'all' ? 0 : parseInt(layerIdx, 10);
  const layer = item.Asset?.Layer?.[index];
  const bx = typeof layer?.DrawingLeft === 'object' ? ((layer.DrawingLeft as LayerPositionOverride)?.[''] ?? 0) : (layer?.DrawingLeft ?? 0);
  const by = typeof layer?.DrawingTop === 'object' ? ((layer.DrawingTop as LayerPositionOverride)?.[''] ?? 0) : (layer?.DrawingTop ?? 0);
  return {bx, by};
}

export function getCurrentGroupName() {
  return getCurrentItem()?.Asset?.Group?.Name ?? null;
}

export function isGroupLocked() {
  const groupName = getCurrentGroupName();
  return groupName ? LOCKED_GROUPS.has(groupName) : false;
}

export function clampPriority(value: number) {
  return Math.max(-99, Math.min(99, value));
}

export function applyPriority(item: Item, rawIdx: LayerId, value: number) {
  const newValue = clampPriority(value);
  if (!item.Property) item.Property = {};
  const layers = item.Asset?.Layer || [];
  if (rawIdx === 'all') {
    item.Property.OverridePriority = newValue;
  } else {
    const members = getLayerGroupMembers(item, parseInt(rawIdx, 10));
    if (typeof item.Property.OverridePriority !== 'object' || item.Property.OverridePriority == null) {
      item.Property.OverridePriority = {};
    }
    members.forEach(index => {
      const layerName = layers[index]?.Name;
      if (layerName) (item.Property.OverridePriority as Record<string, number>)[layerName] = newValue;
    });
  }
  refreshCurrentCharacter(false);
  return newValue;
}
