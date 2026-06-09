import type {CanvasRect} from './types';

export interface OverlayAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const TOOL_PANEL_WIDTH = 240;
export const TOOL_PANEL_MIN_HEIGHT = 120;
export const PARTS_PANEL_WIDTH = 208;
export const PARTS_PANEL_MIN_HEIGHT = 100;
export const OVERLAY_MARGIN = 8;

export function getElementOverlayAnchor(element: Element): OverlayAnchor {
  const rect = element.getBoundingClientRect();
  return {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
}

export function getAnchoredPanelPosition(canvasRect: CanvasRect, anchor: OverlayAnchor, panelWidth = TOOL_PANEL_WIDTH, panelMinHeight = TOOL_PANEL_MIN_HEIGHT) {
  return clampPanelPosition(
    anchor.left - canvasRect.left + anchor.width + OVERLAY_MARGIN,
    anchor.top - canvasRect.top - 10,
    canvasRect,
    panelWidth,
    panelMinHeight,
  );
}

export function clampPanelPosition(left: number, top: number, canvasRect: CanvasRect, panelWidth = TOOL_PANEL_WIDTH, panelMinHeight = TOOL_PANEL_MIN_HEIGHT) {
  return {
    left: Math.max(OVERLAY_MARGIN, Math.min(left, canvasRect.width - panelWidth - OVERLAY_MARGIN)),
    top: Math.max(OVERLAY_MARGIN, Math.min(top, canvasRect.height - panelMinHeight)),
  };
}
