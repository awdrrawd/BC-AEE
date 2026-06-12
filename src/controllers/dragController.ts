import type {LayerId} from '@/core/types';
import {
  ensureLayerOverrides,
  getAssetBaseXY,
  getCanvas,
  getCurrentItem,
  getLayerOverride,
  refreshCurrentCharacter,
  setLayerOverride,
} from '@/core/bc';
import {getState, mutateState} from '@/core/store';
import {forceUiUpdate} from '@/core/context';

interface BaseDragState {
  layerId: LayerId;
  startX: number;
  startY: number;
}

interface XyDragState extends BaseDragState {
  origX: number;
  origY: number;
  flipX: boolean;
  flipY: boolean;
}

interface ScaleDragState extends BaseDragState {
  origSX: number;
  origSY: number;
}

interface SkewDragState extends BaseDragState {
  origSX: number;
  origSY: number;
}

let xyDragState: XyDragState | null = null;
let scaleDragState: ScaleDragState | null = null;
let skewDragState: SkewDragState | null = null;
let handlersInstalled = false;

export function showTouchBlocker() {
  mutateState(() => {
  });
}

export function hideTouchBlocker() {
  mutateState(() => {
  });
}

function canStartCanvasDrag(event: MouseEvent | PointerEvent) {
  const state = getState();
  if (!state.activeDrag || state.activeDrag === 'rot' || state.selectedLayer === null) return false;
  const canvas = getCanvas();
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  const cx = (event.clientX - rect.left) * ((canvas.width || 2000) / rect.width);
  const cy = (event.clientY - rect.top) * ((canvas.height || 1000) / rect.height);
  return !(cx < 300 || cx > 1700 || cy < 50 || cy > 950);
}

export function startCanvasDrag(event: MouseEvent | PointerEvent) {
  const state = getState();
  if (!canStartCanvasDrag(event)) return false;
  const item = getCurrentItem();
  if (!item || state.selectedLayer === null) return false;
  const layerId = state.selectedLayer;
  const layerOverride = getLayerOverride(item, layerId);

  if (state.activeDrag === 'xy') {
    const layerIndex = layerId === 'all' ? 0 : parseInt(layerId, 10);
    const baseLeft = item.Asset?.Layer?.[layerIndex]?.DrawingLeft;
    const baseTop = item.Asset?.Layer?.[layerIndex]?.DrawingTop;
    xyDragState = {
      layerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: layerOverride.DrawingLeft?.[''] ?? (typeof baseLeft === 'object' ? (baseLeft?.[''] ?? 0) : (baseLeft ?? 0)),
      origY: layerOverride.DrawingTop?.[''] ?? (typeof baseTop === 'object' ? (baseTop?.[''] ?? 0) : (baseTop ?? 0)),
      flipX: !!layerOverride.FlipX,
      flipY: !!layerOverride.FlipY,
    };
    return true;
  }

  if (state.activeDrag === 'scale') {
    scaleDragState = {
      layerId,
      startX: event.clientX,
      startY: event.clientY,
      origSX: layerOverride.ScaleX ?? 1,
      origSY: layerOverride.ScaleY ?? 1,
    };
    return true;
  }

  if (state.activeDrag === 'skew') {
    skewDragState = {
      layerId,
      startX: event.clientX,
      startY: event.clientY,
      origSX: layerOverride.SkewX ?? 0,
      origSY: layerOverride.SkewY ?? 0,
    };
    return true;
  }

  return false;
}

function moveXyDrag(event: MouseEvent) {
  const item = getCurrentItem();
  const canvas = getCanvas();
  if (!item || !canvas || !xyDragState) return;
  const rect = canvas.getBoundingClientRect();
  const sx = (canvas.width || 2000) / rect.width;
  const sy = (canvas.height || 1000) / rect.height;
  const dx = (event.clientX - xyDragState.startX) * sx;
  const dy = (event.clientY - xyDragState.startY) * sy;
  ensureLayerOverrides(item);
  const count = item.Asset?.Layer?.length || 1;
  const indices = xyDragState.layerId === 'all'
    ? Array.from({length: count}, (_, index) => index)
    : [parseInt(xyDragState.layerId, 10)];
  indices.forEach(index => {
    const layerOverride = item.Property.LayerOverrides[index] || {};
    layerOverride.DrawingLeft = {'': Math.round(xyDragState.origX + (xyDragState.flipX ? -dx : dx))};
    layerOverride.DrawingTop = {'': Math.round(xyDragState.origY + (xyDragState.flipY ? -dy : dy))};
    item.Property.LayerOverrides[index] = layerOverride;
  });
  refreshCurrentCharacter(false);
  forceUiUpdate();
}

function moveScaleDrag(event: MouseEvent) {
  const state = getState();
  const item = getCurrentItem();
  if (!item || !scaleDragState) return;
  const scalePerPx = 0.005;
  const dx = (event.clientX - scaleDragState.startX) * scalePerPx;
  const dy = (event.clientY - scaleDragState.startY) * scalePerPx;
  let newSX: number;
  let newSY: number;
  if (state.scaleLock) {
    const avgDelta = (dx + dy) / 2;
    const ratio = scaleDragState.origSX > 0 ? scaleDragState.origSY / scaleDragState.origSX : 1;
    newSX = Math.max(0.05, +(scaleDragState.origSX + avgDelta).toFixed(2));
    newSY = Math.max(0.05, +(newSX * ratio).toFixed(2));
  } else {
    newSX = Math.max(0.05, +(scaleDragState.origSX + dx).toFixed(2));
    newSY = Math.max(0.05, +(scaleDragState.origSY + dy).toFixed(2));
  }
  setLayerOverride(item, scaleDragState.layerId as LayerId, 'ScaleX', newSX);
  setLayerOverride(item, scaleDragState.layerId as LayerId, 'ScaleY', newSY);
  forceUiUpdate();
}

function moveSkewDrag(event: MouseEvent) {
  const item = getCurrentItem();
  if (!item || !skewDragState) return;
  const degPerPx = 0.3;
  const dx = (event.clientX - skewDragState.startX) * degPerPx;
  const dy = (event.clientY - skewDragState.startY) * degPerPx;
  setLayerOverride(item, skewDragState.layerId as LayerId, 'SkewX', +(skewDragState.origSX + dx).toFixed(1));
  setLayerOverride(item, skewDragState.layerId as LayerId, 'SkewY', +(skewDragState.origSY + dy).toFixed(1));
  forceUiUpdate();
}

export function installDragHandlers() {
  if (handlersInstalled) return;
  handlersInstalled = true;

  document.addEventListener('mousedown', event => {
    const targetRoot = (event.target as HTMLElement | null)?.getRootNode?.();
    if (targetRoot instanceof ShadowRoot) return;
    if (startCanvasDrag(event)) event.stopImmediatePropagation();
  }, true);

  document.addEventListener('mousemove', event => {
    if (xyDragState) {
      moveXyDrag(event);
      event.stopImmediatePropagation();
    } else if (scaleDragState) {
      moveScaleDrag(event);
      event.stopImmediatePropagation();
    } else if (skewDragState) {
      moveSkewDrag(event);
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('mouseup', event => {
    if (!xyDragState && !scaleDragState && !skewDragState) return;
    xyDragState = null;
    scaleDragState = null;
    skewDragState = null;
    event.stopImmediatePropagation();
  }, true);
}

export function getLayerBaseXYForDisplay(item: Item, layerId: LayerId) {
  return getAssetBaseXY(item, layerId);
}
