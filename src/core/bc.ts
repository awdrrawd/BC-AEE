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
  const indices = layerIdx === 'all' ? Array.from({length: count}, (_, index) => index) : [parseInt(layerIdx, 10)];
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

export function getLayerDisplayName(layer: AssetLayer | null | undefined, index: number | string) {
  if (!layer) return `Layer ${index}`;
  try {
    if (ItemColorLayerNames) {
      const asset = layer.Asset;
      const key = (asset?.DynamicGroupName ?? '') + (asset?.Name ?? '') + (layer.Name ?? '');
      const text = ItemColorLayerNames.get(key);
      if (text && !text.startsWith('MISSING') && text !== key) return text;
    }
  } catch {
    // Fall back to layer.Name below.
  }
  return layer.Name || `Layer ${index}`;
}

export function getLayerColor(item: Item | null, layerIdx: LayerId): string | null {
  if (!item) return null;
  const colors = item.Property?.Color ?? item.Color;
  if (!colors) return null;
  const index = layerIdx === 'all' ? 0 : parseInt(layerIdx, 10);
  if (Array.isArray(colors)) return colors[index] ?? colors[0] ?? null;
  return typeof colors === 'string' ? colors : null;
}

export function setLayerColor(item: Item | null, layerIdx: LayerId, hexColor: string) {
  if (!item) return;
  const count = item.Asset?.Layer?.length || 1;
  const index = layerIdx === 'all' ? 'all' : parseInt(layerIdx, 10);
  if (!item.Property) item.Property = {};
  const color = hexColor as BCColor;

  const initColorArray = (source: BCColor | BCColor[] | undefined) => {
    if (Array.isArray(source)) return source.slice();
    const base = typeof source === 'string' ? source : '#FFFFFF';
    return Array.from({length: count}, () => base);
  };

  if (!Array.isArray(item.Property.Color)) item.Property.Color = initColorArray(item.Property.Color ?? item.Color);
  if (!Array.isArray(item.Color)) item.Color = initColorArray(item.Color);

  if (index === 'all') {
    for (let i = 0; i < count; i++) {
      item.Property.Color[i] = color;
      item.Color[i] = color;
    }
  } else {
    while (item.Property.Color.length <= index) item.Property.Color.push('#FFFFFF');
    while (item.Color.length <= index) item.Color.push('#FFFFFF');
    item.Property.Color[index] = color;
    item.Color[index] = color;
  }
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
    const layerName = layers[parseInt(rawIdx, 10)]?.Name;
    if (!layerName) return newValue;
    if (typeof item.Property.OverridePriority !== 'object' || item.Property.OverridePriority == null) {
      item.Property.OverridePriority = {};
    }
    item.Property.OverridePriority[layerName] = newValue;
  }
  refreshCurrentCharacter(false);
  return newValue;
}
