import type {LayerId} from '@/core/types';
import {
  ensureLayerOverrides,
  getAssetBaseXY,
  getCanvas,
  getCanvasRect,
  getCurrentItem,
  getLayerGroupMembers,
  getLayerOverride,
  refreshAfterLayerEdit,
  setLayerOverride,
} from '@/core/bc';
import {getState} from '@/core/store';
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

const DRAG_CURSORS: Record<string, string> = {
  xy: 'grab',
  rot: 'crosshair',
  scale: 'nwse-resize',
  skew: 'ew-resize',
};

let touchBlocker: HTMLDivElement | null = null;

function buildTouchBlocker() {
  if (touchBlocker) return;
  touchBlocker = document.createElement('div');
  touchBlocker.style.cssText = 'position:fixed;z-index:5000;pointer-events:none;background:transparent;touch-action:none;cursor:default;';
  document.body.appendChild(touchBlocker);
}

export function alignTouchBlocker() {
  if (!touchBlocker) return;
  const rect = getCanvasRect();
  if (!rect) return;
  touchBlocker.style.left = `${rect.left}px`;
  touchBlocker.style.top = `${rect.top}px`;
  touchBlocker.style.width = `${rect.width}px`;
  touchBlocker.style.height = `${rect.height}px`;
}

function updateBlockerCursor() {
  if (!touchBlocker) return;
  const drag = getState().activeDrag;
  touchBlocker.style.cursor = (drag && DRAG_CURSORS[drag]) || 'default';
}

export function showTouchBlocker() {
  buildTouchBlocker();
  alignTouchBlocker();
  if (touchBlocker) touchBlocker.style.display = getState().activeDrag ? 'block' : 'none';
  updateBlockerCursor();
}

export function hideTouchBlocker() {
  if (touchBlocker) touchBlocker.style.display = 'none';
}

let rotationDragging = false;

export function setRotationDragging(active: boolean) {
  rotationDragging = active;
}

function isAeeEditing() {
  const state = getState();
  return !!(state.visible && (state.activeDrag || state.colorPicker.open));
}

const BC_UI_SELECTOR = '.screen-main-container, .screen-main, fieldset[name="color-picker"], [role="menu"], [role="menuitem"], [role="radiogroup"]';

function isOwnUiTarget(event: Event): boolean {
  const path = event.composedPath?.();
  if (path && path.length) {
    for (const node of path) {
      if (node instanceof ShadowRoot) return true;
      if (node instanceof HTMLElement) {
        if (node.dataset?.aeeRoot === 'true') return true;
        if (node.matches(BC_UI_SELECTOR)) return true;
      }
    }
    return false;
  }
  // Fallback for environments without composedPath.
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return !!(target.closest('[data-aee-root]') || target.closest(BC_UI_SELECTOR));
}

function getEventPoint(event: Event): {cx: number; cy: number} | null {
  const pointer = event as MouseEvent & TouchEvent;
  if (typeof pointer.clientX === 'number') return {cx: pointer.clientX, cy: pointer.clientY};
  const touch = pointer.touches?.[0];
  if (touch) return {cx: touch.clientX, cy: touch.clientY};
  return null;
}

function shouldIntercept(event: Event): boolean {
  if (!isAeeEditing()) return false;
  if (isOwnUiTarget(event)) return false;
  const point = getEventPoint(event);
  if (!point) return false;
  const canvas = getCanvas();
  const rect = canvas?.getBoundingClientRect();
  if (!canvas || !rect) return false;
  const sx = rect.width / (canvas.width || 2000);
  const sy = rect.height / (canvas.height || 1000);
  if (point.cx < rect.left + 300 * sx || point.cx > rect.left + 1700 * sx
    || point.cy < rect.top + 50 * sy || point.cy > rect.top + 950 * sy) return false;
  return true;
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
    : getLayerGroupMembers(item, parseInt(xyDragState.layerId, 10));
  indices.forEach(index => {
    const layerOverride = item.Property.LayerOverrides[index] || {};
    layerOverride.DrawingLeft = {'': Math.round(xyDragState.origX + (xyDragState.flipX ? -dx : dx))};
    layerOverride.DrawingTop = {'': Math.round(xyDragState.origY + (xyDragState.flipY ? -dy : dy))};
    item.Property.LayerOverrides[index] = layerOverride;
  });
  refreshAfterLayerEdit();
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
    if (isOwnUiTarget(event)) return;
    rotationDragging = false;
    if (startCanvasDrag(event)) {
      event.stopImmediatePropagation();
      return;
    }
    if (shouldIntercept(event)) event.stopImmediatePropagation();
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
    if (xyDragState || scaleDragState || skewDragState) {
      xyDragState = null;
      scaleDragState = null;
      skewDragState = null;
      event.stopImmediatePropagation();
      return;
    }
    if (rotationDragging) return;
    if (shouldIntercept(event)) {
      event.stopImmediatePropagation();
      updateBlockerCursor();
    }
  }, true);

  document.addEventListener('pointerdown', event => {
    if (shouldIntercept(event)) event.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointerup', event => {
    if (rotationDragging) return;
    if (shouldIntercept(event)) {
      event.stopImmediatePropagation();
      updateBlockerCursor();
    }
  }, true);

  document.addEventListener('touchstart', event => {
    if (shouldIntercept(event)) event.stopImmediatePropagation();
  }, {capture: true, passive: false});
}

export function getLayerBaseXYForDisplay(item: Item, layerId: LayerId) {
  return getAssetBaseXY(item, layerId);
}
