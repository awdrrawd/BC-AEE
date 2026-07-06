import type {AeeState, AeeTab, DragMode, LayerId, TransformOverlayMode} from '@/core/types';
import {getState, mutateState} from '@/core/store';
import {setAeeSetting} from '@/core/settings';
import {
  applyPriority,
  clampPriority,
  ensureLayerOverrides,
  ensureOpacityArray,
  getAssetBaseXY,
  getCurrentItem,
  getLayerColor,
  getLayerGroupMembers,
  getLayerOverride,
  getOpacity,
  refreshAfterLayerEdit,
  refreshCurrentCharacter,
  setLayerColor,
  setLayerOverride,
} from '@/core/bc';
import {runtime} from '@/core/runtime';
import {forceUiUpdate, syncCanvasRect, syncCurrentContext} from '@/core/context';
import {isInAppearanceScreen, updateAppearanceScreenState} from '@/core/appearanceScreenMachine';
import {clearCopyBuffer} from '@/controllers/copyPasteController';
import {
  clampPanelPosition,
  getAnchoredPanelPosition,
  type OverlayAnchor,
  PARTS_PANEL_MIN_HEIGHT,
  PARTS_PANEL_WIDTH,
  TOOL_PANEL_MIN_HEIGHT,
  TOOL_PANEL_WIDTH,
} from '@/core/overlay';
import {alignTouchBlocker, hideTouchBlocker, showTouchBlocker} from '@/controllers/dragController';

type AssetPriority = Asset & { DrawingPriority?: number };
type ToolOverlay = 'parts' | 'opacity' | 'transform';

export function setTab(tab: AeeTab) {
  stopHoverHighlight(true);
  mutateState(draft => {
    draft.tab = tab;
  });
}

export function selectLayer(layerId: LayerId) {
  stopHoverHighlight(true);
  mutateState(draft => {
    draft.selectedLayer = layerId;
  });
}

// Clear the part selection, returning the edit panel to the parts list.
export function deselectLayer() {
  stopHoverHighlight(true);
  mutateState(draft => {
    draft.selectedLayer = null;
  });
}

export function toggleCollapse() {
  mutateState(draft => {
    draft.collapsed = !draft.collapsed;
  });
}

function closeToolOverlays(draft: AeeState, keep: ToolOverlay) {
  // The parts panel is intentionally exempt: it's used to quickly switch the
  // edit target, so opening other tool overlays must not close it.
  if (keep !== 'opacity') draft.opacityOverlay.open = false;
  if (keep !== 'transform') draft.transformOverlay.mode = null;
}

function getClampedCurrentPanelPosition(left: number, top: number, panelWidth = TOOL_PANEL_WIDTH, panelMinHeight = TOOL_PANEL_MIN_HEIGHT) {
  const rect = getState().canvasRect;
  return rect ? clampPanelPosition(left, top, rect, panelWidth, panelMinHeight) : {left, top};
}

export function togglePartsOpen(open?: boolean, anchor?: OverlayAnchor) {
  syncCanvasRect();
  const current = getState();
  const nextOpen = open ?? !current.partsOpen;
  mutateState(draft => {
    draft.partsOpen = nextOpen;
    if (nextOpen && anchor && draft.canvasRect) {
      const pos = getAnchoredPanelPosition(draft.canvasRect, anchor, PARTS_PANEL_WIDTH, PARTS_PANEL_MIN_HEIGHT);
      draft.partsLeft = pos.left;
      draft.partsTop = pos.top;
    }
  });
}

export function movePartsPanel(left: number, top: number) {
  const pos = getClampedCurrentPanelPosition(left, top, PARTS_PANEL_WIDTH, PARTS_PANEL_MIN_HEIGHT);
  mutateState(draft => {
    draft.partsLeft = pos.left;
    draft.partsTop = pos.top;
  });
}

export function toggleTransformOverlay(mode: TransformOverlayMode, anchor?: OverlayAnchor) {
  const item = getCurrentItem();
  if (!item) return;
  syncCanvasRect();
  const current = getState();
  const nextMode = current.transformOverlay.mode === mode ? null : mode;
  mutateState(draft => {
    draft.transformOverlay.mode = nextMode;
    if (nextMode) {
      closeToolOverlays(draft, 'transform');
      if (draft.selectedLayer === null) draft.selectedLayer = 'all';
      if (anchor && draft.canvasRect) {
        const pos = getAnchoredPanelPosition(draft.canvasRect, anchor);
        draft.transformOverlay.left = pos.left;
        draft.transformOverlay.top = pos.top;
      }
    }
  });
}

export function closeTransformOverlay() {
  mutateState(draft => {
    draft.transformOverlay.mode = null;
  });
}

export function moveTransformOverlay(left: number, top: number) {
  const pos = getClampedCurrentPanelPosition(left, top);
  mutateState(draft => {
    draft.transformOverlay.left = pos.left;
    draft.transformOverlay.top = pos.top;
  });
}

export function setActiveDrag(mode: DragMode) {
  const next = getState().activeDrag === mode ? null : mode;
  mutateState(draft => {
    draft.activeDrag = next;
    draft.rotationOverlayOpen = next === 'rot';
  });
  if (next) showTouchBlocker();
  else hideTouchBlocker();
}

export function setScaleLock(value?: boolean) {
  mutateState(draft => {
    draft.scaleLock = value ?? !draft.scaleLock;
  });
}

export function openColorPicker(initialHex: string, onLiveChange: (hex: string, preview?: boolean) => void, bcMode = false, opacityPct = 100, isDefault = false) {
  runtime.colorPickerLiveChange = onLiveChange;
  runtime.colorPickerInitialHex = initialHex || '#FFFFFF';
  syncCanvasRect();
  mutateState(draft => {
    draft.colorPicker.sessionId += 1;
    draft.colorPicker.open = true;
    draft.colorPicker.bcMode = bcMode;
    draft.colorPicker.collapsed = false;
    draft.colorPicker.hex = initialHex || '#FFFFFF';
    draft.colorPicker.initialHex = initialHex || '#FFFFFF';
    draft.colorPicker.opacityPct = opacityPct;
    draft.colorPicker.isDefault = isDefault;
    draft.colorPicker.eyedropperActive = false;
  });
}

export function closeColorPicker(commit = true) {
  const state = getState();
  if (!commit && runtime.colorPickerLiveChange) {
    safeCallLiveChange(state.colorPicker.initialHex, false);
  }
  mutateState(draft => {
    draft.colorPicker.open = false;
    draft.colorPicker.bcMode = false;
    draft.colorPicker.collapsed = false;
    draft.colorPicker.eyedropperActive = false;
  });
  runtime.colorPickerLiveChange = null;
}

export function setEyedropperActive(active: boolean) {
  mutateState(draft => {
    draft.colorPicker.eyedropperActive = active;
  });
}

function safeCallLiveChange(hex: string, preview: boolean) {
  if (!runtime.colorPickerLiveChange) return;
  try {
    runtime.colorPickerLiveChange(hex, preview);
  } catch (err) {
    console.warn('[AEE] colorPickerLiveChange threw, closing picker:', err);
    runtime.colorPickerLiveChange = null;
    mutateState(draft => { draft.colorPicker.open = false; draft.colorPicker.bcMode = false; });
  }
}

export function previewColorPickerValue(hex: string, opacityPct?: number) {
  const state = getState();
  const nextOpacityPct = opacityPct ?? state.colorPicker.opacityPct;
  runtime.colorPickerAlpha = Math.round((nextOpacityPct / 100) * 255);
  safeCallLiveChange(hex, true);
}

export function setColorPickerValue(hex: string, opacityPct?: number) {
  const state = getState();
  const nextOpacityPct = opacityPct ?? state.colorPicker.opacityPct;
  runtime.colorPickerAlpha = Math.round((nextOpacityPct / 100) * 255);
  if (state.colorPicker.hex === hex && state.colorPicker.opacityPct === nextOpacityPct) {
    safeCallLiveChange(hex, false);
    return;
  }
  mutateState(draft => {
    draft.colorPicker.hex = hex;
    if (opacityPct !== undefined) draft.colorPicker.opacityPct = opacityPct;
  });
  safeCallLiveChange(hex, false);
}

export function setColorPickerCollapsed(collapsed: boolean) {
  mutateState(draft => {
    draft.colorPicker.collapsed = collapsed;
  });
}

export function moveColorPicker(left: number, top: number) {
  mutateState(draft => {
    draft.colorPicker.left = left;
    draft.colorPicker.top = top;
  });
}

export function openLayerColorPicker(layerId: LayerId) {
  const item = getCurrentItem();
  const storedColor = getLayerColor(item, layerId);
  const isDefault = !storedColor || storedColor === 'Default';
  const currentColor = (storedColor && storedColor !== 'Default' ? storedColor : null) || '#FFFFFF';
  openColorPicker(currentColor, (hex, preview) => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;
    setLayerColor(currentItem, layerId, hex);
    if (!preview) forceUiUpdate();
  }, false, 100, isDefault);
}

export function openSelectedLayerColorPicker() {
  const state = getState();
  openLayerColorPicker(state.selectedLayer ?? 'all');
}

export function openOpacityOverlay(anchor?: OverlayAnchor) {
  const item = getCurrentItem();
  const selected = getState().selectedLayer;
  if (!item) return;
  syncCanvasRect();
  mutateState(draft => {
    draft.opacityOverlay.open = true;
    closeToolOverlays(draft, 'opacity');
    if (selected === null) draft.selectedLayer = 'all';
    if (anchor && draft.canvasRect) {
      const pos = getAnchoredPanelPosition(draft.canvasRect, anchor);
      draft.opacityOverlay.left = pos.left;
      draft.opacityOverlay.top = pos.top;
    }
  });
}

export function closeOpacityOverlay() {
  mutateState(draft => {
    draft.opacityOverlay.open = false;
  });
}

export function moveOpacityOverlay(left: number, top: number) {
  const pos = getClampedCurrentPanelPosition(left, top);
  mutateState(draft => {
    draft.opacityOverlay.left = pos.left;
    draft.opacityOverlay.top = pos.top;
  });
}

export function setOpacity(layerId: LayerId, pct: number) {
  const item = getCurrentItem();
  if (!item) return;
  setLayerOverride(item, layerId, 'Opacity', Math.max(0, Math.min(100, pct)) / 100);
  forceUiUpdate();
}

export function stepOpacity(layerId: LayerId, delta: number) {
  const item = getCurrentItem();
  if (!item) return;
  const current = getLayerOverride(item, layerId);
  const next = Math.max(0, Math.min(100, Math.round((current.Opacity ?? 1) * 100) + delta));
  setOpacity(layerId, next);
}

export function setEditProperty(ctrl: string, rawValue: number) {
  const state = getState();
  const item = getCurrentItem();
  const idx = state.selectedLayer;
  if (!item || idx === null || Number.isNaN(rawValue)) return;
  if (ctrl === 'x') setLayerOverride(item, idx, 'DrawingLeft', {'': Math.round(rawValue)});
  else if (ctrl === 'y') setLayerOverride(item, idx, 'DrawingTop', {'': Math.round(rawValue)});
  else if (ctrl === 'sx') setLayerOverride(item, idx, 'ScaleX', Math.max(0.05, +rawValue.toFixed(2)));
  else if (ctrl === 'sy') setLayerOverride(item, idx, 'ScaleY', Math.max(0.05, +rawValue.toFixed(2)));
  else if (ctrl === 'rot') setLayerOverride(item, idx, 'Rotation', ((Math.round(rawValue) % 360) + 360) % 360);
  else if (ctrl === 'skx') setLayerOverride(item, idx, 'SkewX', +rawValue.toFixed(1));
  else if (ctrl === 'sky') setLayerOverride(item, idx, 'SkewY', +rawValue.toFixed(1));
  else if (ctrl === 'fcx') setLayerOverride(item, idx, 'MirrorCopyAxisX', Math.max(0, Math.min(1, +rawValue.toFixed(2))));
  else if (ctrl === 'fcy') setLayerOverride(item, idx, 'MirrorCopyAxisY', Math.max(0, Math.min(1, +rawValue.toFixed(2))));
  forceUiUpdate();
}

export function stepEditProperty(ctrl: string, delta: number) {
  const state = getState();
  const item = getCurrentItem();
  const idx = state.selectedLayer;
  if (!item || idx === null) return;
  const layerOverride = getLayerOverride(item, idx);
  const {bx, by} = getAssetBaseXY(item, idx);
  if (ctrl === 'x') setLayerOverride(item, idx, 'DrawingLeft', {'': (layerOverride.DrawingLeft?.[''] ?? bx) + delta});
  else if (ctrl === 'y') setLayerOverride(item, idx, 'DrawingTop', {'': (layerOverride.DrawingTop?.[''] ?? by) + delta});
  else if (ctrl === 'sx') setLayerOverride(item, idx, 'ScaleX', Math.max(0.05, +((layerOverride.ScaleX ?? 1) + delta).toFixed(2)));
  else if (ctrl === 'sy') setLayerOverride(item, idx, 'ScaleY', Math.max(0.05, +((layerOverride.ScaleY ?? 1) + delta).toFixed(2)));
  else if (ctrl === 'rot') setLayerOverride(item, idx, 'Rotation', ((layerOverride.Rotation ?? 0) + delta + 360) % 360);
  else if (ctrl === 'skx') setLayerOverride(item, idx, 'SkewX', +((layerOverride.SkewX ?? 0) + delta).toFixed(1));
  else if (ctrl === 'sky') setLayerOverride(item, idx, 'SkewY', +((layerOverride.SkewY ?? 0) + delta).toFixed(1));
  else if (ctrl === 'fcx') setLayerOverride(item, idx, 'MirrorCopyAxisX', Math.max(0, Math.min(1, +((layerOverride.MirrorCopyAxisX ?? 0.5) + delta).toFixed(2))));
  else if (ctrl === 'fcy') setLayerOverride(item, idx, 'MirrorCopyAxisY', Math.max(0, Math.min(1, +((layerOverride.MirrorCopyAxisY ?? 0.5) + delta).toFixed(2))));
  forceUiUpdate();
}

export function resetEditProperty(ctrl: string) {
  const state = getState();
  const item = getCurrentItem();
  const idx = state.selectedLayer;
  if (!item || idx === null) return;
  ensureLayerOverrides(item);
  const count = item.Asset?.Layer?.length || 1;
  const indices = idx === 'all' ? Array.from({length: count}, (_, index) => index) : getLayerGroupMembers(item, parseInt(idx, 10));

  if (ctrl === 'x' || ctrl === 'y') {
    const key = ctrl === 'x' ? 'DrawingLeft' : 'DrawingTop';
    indices.forEach(index => {
      if (item.Property?.LayerOverrides?.[index]) delete item.Property.LayerOverrides[index][key];
    });
    refreshAfterLayerEdit();
  } else if (ctrl === 'op') {
    ensureOpacityArray(item);
    indices.forEach(index => {
      const def = item.Asset?.Layer?.[index]?.Opacity ?? 1;
      if (item.Property.LayerOverrides?.[index]) delete item.Property.LayerOverrides[index].Opacity;
      const opacityArray = item.Property.Opacity;
      if (Array.isArray(opacityArray) && index < opacityArray.length) opacityArray[index] = def;
    });
    refreshCurrentCharacter(true);
  } else if (ctrl === 'sx') setLayerOverride(item, idx, 'ScaleX', 1);
  else if (ctrl === 'sy') setLayerOverride(item, idx, 'ScaleY', 1);
  else if (ctrl === 'rot') setLayerOverride(item, idx, 'Rotation', 0);
  else if (ctrl === 'skx') setLayerOverride(item, idx, 'SkewX', 0);
  else if (ctrl === 'sky') setLayerOverride(item, idx, 'SkewY', 0);
  else if (ctrl === 'fcx' || ctrl === 'mc') {
    setLayerOverride(item, idx, 'MirrorCopyAxisX', 0.5);
    setLayerOverride(item, idx, 'MirrorCopyAxisY', 0.5);
  }
  forceUiUpdate();
}

export function toggleMirror(key: 'FlipX' | 'FlipY' | 'MirrorCopy' | 'MirrorCopyV') {
  const state = getState();
  const item = getCurrentItem();
  if (!item || state.selectedLayer === null) return;
  const layerOverride = getLayerOverride(item, state.selectedLayer);
  setLayerOverride(item, state.selectedLayer, key, !layerOverride[key]);
  forceUiUpdate();
}

export function resetSelectedTransforms() {
  const state = getState();
  const item = getCurrentItem();
  if (!item || state.selectedLayer === null) return;
  resetEditProperty('x');
  resetEditProperty('y');
  setLayerOverride(item, state.selectedLayer, 'ScaleX', 1);
  setLayerOverride(item, state.selectedLayer, 'ScaleY', 1);
  setLayerOverride(item, state.selectedLayer, 'Rotation', 0);
  setLayerOverride(item, state.selectedLayer, 'SkewX', 0);
  setLayerOverride(item, state.selectedLayer, 'SkewY', 0);
  forceUiUpdate();
}

export function stepPriority(layerId: LayerId, delta: number) {
  const item = getCurrentItem();
  if (!item) return;
  const layers = item.Asset?.Layer || [];
  let current: number;
  if (layerId === 'all') {
    const override = item.Property?.OverridePriority;
    current = typeof override === 'number' ? override : getAssetDrawingPriority(item.Asset);
  } else {
    const index = parseInt(layerId, 10);
    const layerName = layers[index]?.Name ?? '';
    const override = item.Property?.OverridePriority;
    current = typeof override === 'object' && override?.[layerName] != null ? override[layerName] : (layers[index]?.Priority ?? 0);
  }
  applyPriority(item, layerId, current + delta);
  forceUiUpdate();
}

export function setPriority(layerId: LayerId, value: number) {
  const item = getCurrentItem();
  if (!item) return;
  applyPriority(item, layerId, value);
  forceUiUpdate();
}

export function resetPriority(layerId: LayerId) {
  const item = getCurrentItem();
  if (!item) return;
  const layers = item.Asset?.Layer || [];
  if (layerId === 'all') {
    if (item.Property) delete item.Property.OverridePriority;
  } else if (typeof item.Property?.OverridePriority === 'object') {
    getLayerGroupMembers(item, parseInt(layerId, 10)).forEach(index => {
      if (!layers[index]) return;
      const layerName = layers[index].Name ?? '';
      delete (item.Property!.OverridePriority as Record<string, number>)[layerName];
    });
    if (Object.keys(item.Property.OverridePriority).length === 0) delete item.Property.OverridePriority;
  }
  refreshAfterLayerEdit();
  forceUiUpdate();
}

export function setSetting(key: string, value: boolean) {
  setAeeSetting(key, value);
  if (key === 'showCharCtrl') updateAppearanceScreenState();
  mutateState(draft => {
    if (key === 'hoverHighlight') {
      draft.hoverHighlight = value;
      if (!value) stopHoverHighlight(true);
    } else if (key === 'hoverHighlightChar') {
      draft.hoverHighlightChar = value;
      if (!value) stopHoverCharHighlight();
    } else if (key === 'hoverTryOn') {
      draft.hoverTryOn = value;
      if (!value) stopHoverTryOn();
    } else if (key === 'enableCopyPaste') {
      draft.enableCopyPaste = value;
      if (!value) clearCopyBuffer();
    } else if (key === 'hideLscgLayers') {
      draft.hideLscgLayers = value;
      applyLscgLayersVisibility(value);
    } else if (key === 'showCharCtrl') {
      draft.showCharCtrl = value;
      draft.charControl.visible = value && isInAppearanceScreen();
    } else if (key === 'enableAeeMenu') {
      draft.enableAeeMenu = value;
    } else if (key === 'useAeeColorPicker') {
      draft.useAeeColorPicker = value;
    } else if (key === 'pasteImport') {
      draft.pasteImport = value;
    } else if (key === 'bcWheelScroll') {
      draft.bcWheelScroll = value;
    }
  });
}

export function applyLscgLayersVisibility(value = getState().hideLscgLayers) {
  const el = document.getElementById('lscg-layers');
  if (!el) return;
  el.style.display = value ? 'none' : '';
}

export function startHoverHighlight(item: Item, layerIdx: LayerId) {
  if (!item) return;
  stopHoverHighlight(false);
  const indices = layerIdx === 'all'
    ? Array.from({length: item.Asset?.Layer?.length || 1}, (_, index) => index)
    : getLayerGroupMembers(item, parseInt(layerIdx, 10));
  runtime.hoverHighlightStartTime = performance.now();

  const animate = () => {
    if (runtime.hoverHighlightAnimFrame === null) return;
    const t = ((performance.now() - runtime.hoverHighlightStartTime!) % 1500) / 1500;
    const opacity = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);
    const overrides = new Map<number, number>();
    indices.forEach(index => overrides.set(index, opacity));
    runtime.hoverFlashData = {item, overrides};
    try {
      // Reload whichever character drives the visible render. In the ItemColor
      // (restraint) screen the preview is the item-colour character, which may
      // differ from CharacterAppearanceSelection - reload both so the flash shows.
      const primary = CharacterAppearanceSelection || runtime.itemColorChar;
      if (primary) CharacterLoadCanvas?.(primary);
      if (runtime.itemColorChar && runtime.itemColorChar !== primary) CharacterLoadCanvas?.(runtime.itemColorChar);
    } catch {
      // Ignore transient render errors.
    }
    runtime.hoverHighlightAnimFrame = requestAnimationFrame(animate);
  };

  runtime.hoverHighlightAnimFrame = requestAnimationFrame(animate);
}

export function stopHoverHighlight(refresh = false) {
  if (runtime.hoverHighlightAnimFrame !== null) {
    cancelAnimationFrame(runtime.hoverHighlightAnimFrame);
    runtime.hoverHighlightAnimFrame = null;
  }
  runtime.hoverFlashData = null;
  runtime.hoverHighlightStartTime = null;
  if (refresh) {
    try {
      CharacterLoadCanvas?.(CharacterAppearanceSelection || runtime.itemColorChar);
    } catch {
      // Ignore transient render errors.
    }
  }
}

export function startHoverCharHighlight(groupName: AssetGroupName) {
  const character = CharacterAppearanceSelection;
  if (!character) return;
  runtime.hoverCharStartTime = performance.now();
  const item = InventoryGet(character, groupName);
  if (!item) {
    startHoverCharFallback(groupName);
    return;
  }
  const layerCount = item.Asset?.Layer?.length || 1;
  runtime.hoverCharActive = true;
  const animate = () => {
    if (!runtime.hoverCharActive || runtime.hoverCharGroup !== groupName) return;
    const t = ((performance.now() - runtime.hoverCharStartTime!) % 1500) / 1500;
    const opacity = 0.2 + 0.8 * Math.abs(Math.cos(t * Math.PI));
    const overrides = new Map<number, number>();
    for (let i = 0; i < layerCount; i++) overrides.set(i, opacity);
    runtime.hoverCharFlashData = {item, overrides};
    CharacterLoadCanvas(character);
    runtime.hoverCharAnimFrame = requestAnimationFrame(animate);
  };
  runtime.hoverCharAnimFrame = requestAnimationFrame(animate);
}

function startHoverCharFallback(groupName: string) {
  const character = CharacterAppearanceSelection;
  const blink = () => {
    if (runtime.hoverCharGroup !== groupName) return;
    if (runtime.hoverCharHiddenGroup.has(groupName)) runtime.hoverCharHiddenGroup.delete(groupName);
    else runtime.hoverCharHiddenGroup.add(groupName);
    if (character) CharacterLoadCanvas(character);
    runtime.hoverCharTimer = window.setTimeout(blink, runtime.hoverCharHiddenGroup.has(groupName) ? 200 : 800);
  };
  runtime.hoverCharHiddenGroup.add(groupName);
  if (character) CharacterLoadCanvas(character);
  runtime.hoverCharTimer = window.setTimeout(blink, 200);
}

export function stopHoverCharHighlight() {
  runtime.hoverCharActive = false;
  runtime.hoverCharFlashData = null;
  runtime.hoverCharGroup = null;
  runtime.hoverCharStartTime = null;
  runtime.hoverCharHiddenGroup.clear();
  if (runtime.hoverCharAnimFrame !== null) {
    cancelAnimationFrame(runtime.hoverCharAnimFrame);
    runtime.hoverCharAnimFrame = null;
  }
  if (runtime.hoverCharTimer !== null) {
    clearTimeout(runtime.hoverCharTimer);
    runtime.hoverCharTimer = null;
  }
  const character = CharacterAppearanceSelection;
  if (character) CharacterLoadCanvas?.(character);
}

// Temporarily "wear" the hovered Cloth-grid item on the main character so the
// player can see how it looks, without committing it. Uses CharacterLoadCanvas
// (local redraw only) so the preview is never synced to other players.
export function applyHoverTryOn(item: DialogInventoryItem) {
  const character = CharacterAppearanceSelection;
  const asset = item?.Asset;
  if (!character || !asset?.Group?.Name) return;
  const group = asset.Group.Name;
  const assetName = asset.Name;
  if (runtime.hoverTryOnActive && runtime.hoverTryOnGroup === group && runtime.hoverTryOnAsset === assetName) return;

  // Switched to a different group while still previewing: put the old group back first.
  if (runtime.hoverTryOnActive && runtime.hoverTryOnGroup && runtime.hoverTryOnGroup !== group) {
    restoreTryOnGroup(character, runtime.hoverTryOnGroup, runtime.hoverTryOnBackup);
    runtime.hoverTryOnActive = false;
    runtime.hoverTryOnBackup = null;
  }

  // Capture the real worn item (by reference, keeping its Property) once per group,
  // before the first preview swap, so it can be restored exactly.
  if (!runtime.hoverTryOnActive || runtime.hoverTryOnGroup !== group) {
    runtime.hoverTryOnBackup = InventoryGet(character, group);
    runtime.hoverTryOnGroup = group;
  }

  try {
    // Force the asset's own default color instead of inheriting the group's
    // current color. Passing null here would make BC keep the worn item's color
    // (its color-inheritance-by-group behaviour); passing DefaultColor overrides it.
    const defaultColor: ItemColor | null = asset.DefaultColor ? [...asset.DefaultColor] : null;
    CharacterAppearanceSetItem(character, group, asset, defaultColor);
    runtime.hoverTryOnActive = true;
    runtime.hoverTryOnAsset = assetName;
    CharacterLoadCanvas(character);
  } catch {
    // Ignore transient render errors.
  }
}

export function stopHoverTryOn(redraw = true) {
  if (!runtime.hoverTryOnActive) return;
  const character = CharacterAppearanceSelection;
  if (character && runtime.hoverTryOnGroup) {
    restoreTryOnGroup(character, runtime.hoverTryOnGroup, runtime.hoverTryOnBackup);
    if (redraw) {
      try {
        CharacterLoadCanvas(character);
      } catch {
        // Ignore transient render errors.
      }
    }
  }
  runtime.hoverTryOnActive = false;
  runtime.hoverTryOnGroup = null;
  runtime.hoverTryOnAsset = null;
  runtime.hoverTryOnBackup = null;
}

function restoreTryOnGroup(character: Character, group: string, backup: Item | null) {
  character.Appearance = character.Appearance.filter(appearanceItem => appearanceItem.Asset?.Group?.Name !== group);
  if (backup) character.Appearance.push(backup);
}

export function setCharControlVisible(visible: boolean) {
  mutateState(draft => {
    draft.charControl.visible = visible;
    if (!visible) {
      draft.charControl.open = false;
      draft.offset.open = false;
      draft.pose.open = false;
      draft.bg.settingsOpen = false;
    }
  });
}

export function syncAfterBcRender() {
  syncCurrentContext();
  applyLscgLayersVisibility();
  // Keep the drag touch-blocker glued to the canvas across resizes/screen layout
  // changes while a drag-edit mode is active.
  if (getState().activeDrag) alignTouchBlocker();
}

export function getPriorityValue(item: Item, layerId: LayerId) {
  const layers = item.Asset?.Layer || [];
  if (layerId === 'all') {
    const base = getAssetDrawingPriority(item.Asset);
    const override = item.Property?.OverridePriority;
    return {
      base,
      current: typeof override === 'number' ? override : base,
      overridden: typeof override === 'number',
    };
  }
  const index = parseInt(layerId, 10);
  const base = typeof layers[index]?.Priority === 'number' ? layers[index].Priority : 0;
  const layerName = layers[index]?.Name ?? '';
  const override = item.Property?.OverridePriority;
  const current = typeof override === 'object' && override?.[layerName] != null ? override[layerName] : base;
  return {
    base,
    current: clampPriority(current),
    overridden: typeof override === 'object' && override?.[layerName] != null,
  };
}

export function readOpacityPct(item: Item, layerId: LayerId) {
  const opacity = getOpacity(item, layerId);
  return opacity === null ? null : Math.round(opacity * 100);
}

function getAssetDrawingPriority(asset: Asset | undefined) {
  const value = (asset as AssetPriority | undefined)?.DrawingPriority;
  return typeof value === 'number' ? value : 0;
}
