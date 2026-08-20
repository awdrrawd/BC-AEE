// 圖層管理器 (Layer Manager): a panel listing every drawable layer currently
// worn on a character — one row per AssetLayer of every worn item — sorted by
// effective drawing Priority, with the priority directly editable per row.
//
// This mirrors BC's own native Layering sub-screen (Scripts/Layering.js),
// which does the same edit but one item at a time. The value here is seeing
// ALL worn items' layers on one sorted list at once, since layering problems
// are inherently about ordering across items, not within a single one.
//
// PRIORITY MODEL (must match how BC actually draws, not just how its own
// editor UI happens to write): CommonDraw.js computes each layer's drawing
// priority as:
//   typeof item.Property.OverridePriority === 'number'
//     ? item.Property.OverridePriority                       // whole item, all its layers
//     : item.Property.OverridePriority?.[layer.Name ?? '']    // per-layer, keyed by layer.Name (or '' when unnamed)
//       ?? layer.Priority                                     // the asset's built-in default
// setLayerPriority() below writes using that exact same key scheme, so a
// change here is guaranteed to actually affect what gets drawn — not just
// change a value that BC's renderer never reads back.

import {t} from '@/i18n/i18n';
import {syncCharacterToRoom} from '@/components/mask-system/freeDraw/maskToggle';
import {isAppearanceOverlayActive} from '@/controllers/copyPasteController';
import {settings} from '@/core/settings';
import {getState, mutateState} from '@/core/store';
import {clampPanelPosition} from '@/core/overlay';
import type {LayerManagerFilterMode, LayerManagerSortDirection} from '@/core/types';

export const LAYER_MANAGER_ICON = 'Icons/Layering.png';
export const LAYER_MANAGER_PANEL_WIDTH = 560;
export const LAYER_MANAGER_PANEL_MIN_HEIGHT = 420;

type PropsWithOverride = { OverridePriority?: number | Record<string, number> };

function isGroupsScreen(): boolean {
  return CharacterAppearanceMode === '' && !isAppearanceOverlayActive();
}

export function isLayerManagerAvailable(): boolean {
  return settings.enableLayerManager.get() && isGroupsScreen();
}

export function layerManagerTooltip(): string {
  return t('layer-manager-tooltip');
}

export interface LayerRow {
  id: string;
  item: Item;
  groupName: string;
  /** 群組 — the body-part group this item is worn in (e.g. "上衣"). */
  groupLabel: string;
  /** 服裝名 — the worn item's display name. */
  itemLabel: string;
  /** 部件 — the specific layer's display name within that item. */
  partLabel: string;
  /** The key setLayerPriority() must use to address this exact layer. */
  effectiveKey: string;
  layerIndex: number;
  /** The asset's built-in priority for this layer, absent any override. */
  layerDefault: number;
  /** What actually gets drawn with right now (override, if any, else default). */
  priority: number;
  /** Whether this layer currently has an explicit override (item- or layer-level). */
  isCustom: boolean;
}

function effectivePriority(op: number | Record<string, number> | undefined, layerName: string | null, fallback: number): number {
  if (typeof op === 'number') return op;
  if (op && typeof op === 'object') {
    const v = op[layerName ?? ''];
    if (typeof v === 'number') return v;
  }
  return fallback;
}

function hasOverride(op: number | Record<string, number> | undefined, layerName: string | null): boolean {
  if (typeof op === 'number') return true;
  if (op && typeof op === 'object') return typeof op[layerName ?? ''] === 'number';
  return false;
}

/** Every drawable layer of every worn item, sorted back-to-front by effective priority. */
export function buildLayerRows(C: Character): LayerRow[] {
  const rows: LayerRow[] = [];
  for (const item of C.Appearance) {
    const asset = item.Asset;
    if (!asset || !Array.isArray(asset.Layer) || asset.Layer.length === 0) continue;
    const op = (item.Property as PropsWithOverride | undefined)?.OverridePriority;
    const groupName = asset.Group?.Name ?? '';
    const groupLabel = asset.Group?.Description || groupName;
    const itemLabel = asset.Description || asset.Name;
    for (const [layerIndex, layer] of asset.Layer.entries()) {
      const effectiveKey = layer.Name ?? '';
      rows.push({
        id: `${groupName}::${effectiveKey}`,
        item,
        groupName,
        groupLabel,
        itemLabel,
        partLabel: layer.Name || asset.Name,
        effectiveKey,
        layerIndex,
        layerDefault: layer.Priority,
        priority: effectivePriority(op, layer.Name, layer.Priority),
        isCustom: hasOverride(op, layer.Name),
      });
    }
  }
  rows.sort((a, b) => a.priority - b.priority
    || a.itemLabel.localeCompare(b.itemLabel)
    || a.partLabel.localeCompare(b.partLabel));
  return rows;
}

export function filterLayerRows(rows: LayerRow[], search: string, mode: LayerManagerFilterMode): LayerRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter(row => {
    if (mode === 'custom' && !row.isCustom) return false;
    if (mode === 'default' && row.isCustom) return false;
    if (!needle) return true;
    return row.groupLabel.toLowerCase().includes(needle)
      || row.itemLabel.toLowerCase().includes(needle)
      || row.partLabel.toLowerCase().includes(needle);
  });
}

/**
 * Set one layer's drawing priority, writing OverridePriority using the exact
 * key BC's renderer reads (see the module comment). Clamped to [-99, 99],
 * matching BC's own Layering-screen limit. Setting a layer back to its
 * built-in default prunes that key rather than storing a redundant override,
 * same as BC's own editor does.
 */
export function setLayerPriority(C: Character, row: LayerRow, rawValue: number) {
  const item = row.item;
  const asset = item.Asset;
  if (!asset || !Array.isArray(asset.Layer)) return;
  const clamped = CommonClamp(Math.round(rawValue), -99, 99);

  if (!CommonIsObject(item.Property)) item.Property = {};
  const prop = item.Property as PropsWithOverride;
  const current = prop.OverridePriority;

  let next: Record<string, number>;
  if (typeof current === 'number') {
    // An item-wide number override applies to every layer of this item. To
    // change just ONE layer we must first expand it into a per-layer object,
    // carrying every other layer forward at the value they're currently
    // (visually) drawing at, so this edit doesn't silently reorder them too.
    next = {};
    for (const layer of asset.Layer) {
      const key = layer.Name ?? '';
      next[key] = key === row.effectiveKey ? clamped : current;
    }
  } else {
    next = CommonIsObject(current) ? {...(current as Record<string, number>)} : {};
    next[row.effectiveKey] = clamped;
  }

  // Prune entries that now match their own layer's built-in default, keeping
  // the saved Property minimal — mirrors BC's own _ApplyLayerPriority.
  for (const layer of asset.Layer) {
    const key = layer.Name ?? '';
    if (next[key] === layer.Priority) delete next[key];
  }

  if (Object.keys(next).length === 0) delete prop.OverridePriority;
  else prop.OverridePriority = next;

  CharacterRefresh(C, true, false);
  syncCharacterToRoom(C, row.groupName);
}

export function resetLayerPriority(C: Character, row: LayerRow) {
  setLayerPriority(C, row, row.layerDefault);
}

export function openLayerManagerPanel() {
  const target = CharacterAppearanceSelection ?? Player;
  mutateState(draft => {
    draft.layerManager.open = true;
    draft.layerManager.target = target;
  });
}

export function closeLayerManagerPanel() {
  mutateState(draft => {
    draft.layerManager.open = false;
  });
}

export function setLayerManagerSearch(search: string) {
  mutateState(draft => {
    draft.layerManager.search = search;
  });
}

export function cycleLayerManagerFilterMode() {
  const order: LayerManagerFilterMode[] = ['all', 'custom', 'default'];
  const current = getState().layerManager.filterMode;
  const next = order[(order.indexOf(current) + 1) % order.length];
  mutateState(draft => {
    draft.layerManager.filterMode = next;
  });
}

export function setLayerManagerFilterMode(mode: LayerManagerFilterMode) {
  mutateState(draft => {
    draft.layerManager.filterMode = mode;
  });
}

export function toggleLayerManagerSortDirection() {
  mutateState(draft => {
    draft.layerManager.sortDirection = draft.layerManager.sortDirection === 'asc' ? 'desc' : 'asc';
  });
}

export function sortLayerRows(rows: LayerRow[], direction: LayerManagerSortDirection): LayerRow[] {
  return direction === 'asc' ? rows : [...rows].reverse();
}

/** Open BC's colour screen for the row's worn item when it has colourable layers. */
export function openLayerRowColor(target: Character, row: LayerRow): boolean {
  const colorable = row.item.Asset?.Layer?.some(layer => !layer.CopyLayerColor && layer.AllowColorize && !layer.HideColoring);
  if (!colorable || typeof AppearanceItemColor !== 'function') return false;
  closeLayerManagerPanel();
  const group = row.item.Asset.Group;
  if (group) target.FocusGroup = group as AssetItemGroup;
  const mode = CharacterAppearanceMode;
  AppearanceItemColor(target, row.item, row.groupName as AssetGroupName, mode === 'Wardrobe' || mode === 'Cloth' || mode === 'Color' ? mode : '');
  return true;
}

export function moveLayerManagerPanel(left: number, top: number) {
  const canvasRect = getState().canvasRect;
  const clamped = canvasRect
    ? clampPanelPosition(left, top, canvasRect, LAYER_MANAGER_PANEL_WIDTH, LAYER_MANAGER_PANEL_MIN_HEIGHT)
    : {left, top};
  mutateState(draft => {
    draft.layerManager.left = clamped.left;
    draft.layerManager.top = clamped.top;
  });
}
