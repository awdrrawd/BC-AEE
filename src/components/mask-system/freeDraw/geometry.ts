// Geometry & coordinate helpers: mapping between screen space and the
// 500×1000 board space, the on-screen board rect (character position +
// slot offset), picker-grid layout, and a couple of small color helpers
// used by the toolbar.

import {
  BOARD_W, BOARD_H, DRAW_X, DRAW_Y,
  STROKE_BAR_X, STROKE_BAR_W, STROKE_MIN, STROKE_MAX,
  PICKER_X, PICKER_Y, PICKER_ITEM, PICKER_GAP, PICKER_PAD, PICKER_PER_ROW,
} from '../constants';
import {A} from './slots';
import {State} from './editorState';

export function getCharacterDrawRect(C: Character | null, X: number, Y: number, Zoom: number, isHeightResizeAllowed?: boolean) {
  if (!C) return {x: X, y: Y, w: 500 * Zoom, h: 1000 * Zoom};
  const HeightRatio = (isHeightResizeAllowed == null || isHeightResizeAllowed === true) ? C.HeightRatio : 1;
  const XOffset = CharacterAppearanceXOffset(C, HeightRatio);
  const YOffset = CharacterAppearanceYOffset(C, HeightRatio);
  return {x: X + XOffset * Zoom, y: Y + YOffset * Zoom, w: 500 * HeightRatio * Zoom, h: 1000 * HeightRatio * Zoom};
}

interface DrawArgs {X: number; Y: number; Zoom: number; IsHeightResizeAllowed?: boolean}
const lastCharDrawArgs = new Map<number | Character, DrawArgs>();
export function cacheDrawArgs(C: Character | null, X: number, Y: number, Zoom: number, isHeightResizeAllowed?: boolean) {
  if (!C) return;
  const current = typeof CharacterGetCurrent === 'function' ? CharacterGetCurrent() : null;
  if (current && C !== current) return;
  const key = C.MemberNumber != null ? C.MemberNumber : C;
  lastCharDrawArgs.set(key, {X, Y, Zoom, IsHeightResizeAllowed: isHeightResizeAllowed});
}
function getCachedDrawArgs(C: Character | null): DrawArgs | null {
  if (!C) return null;
  const key = C.MemberNumber != null ? C.MemberNumber : C;
  return lastCharDrawArgs.get(key) || null;
}

export function getBoardScreenRect() {
  const C = CharacterGetCurrent();
  const cached = getCachedDrawArgs(C);
  const base = cached
    ? getCharacterDrawRect(C, cached.X, cached.Y, cached.Zoom, cached.IsHeightResizeAllowed)
    : getCharacterDrawRect(C, DRAW_X, DRAW_Y, 1, undefined);
  const ox = A ? A.offsetX : 0, oy = A ? A.offsetY : 0;
  return {x: base.x + ox * (base.w / 500), y: base.y + oy * (base.h / 1000), w: base.w, h: base.h};
}

export function toLocal(cx: number, cy: number): [number, number] {
  const rect = getBoardScreenRect();
  return [(cx - rect.x) / rect.w * BOARD_W, (cy - rect.y) / rect.h * BOARD_H];
}
export function inBoardArea(cx: number, cy: number): boolean {
  const rect = getBoardScreenRect();
  return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
}
export function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}
export function updateStrokeFromPointerX(cx: number) {
  const ratio = Math.min(1, Math.max(0, (cx - STROKE_BAR_X) / STROKE_BAR_W));
  State.thickness = Math.round(STROKE_MIN + ratio * (STROKE_MAX - STROKE_MIN));
}
export function getPickerLayout(count: number) {
  const rows = Math.max(1, Math.ceil(count / PICKER_PER_ROW));
  return {rows, height: PICKER_PAD * 2 + rows * PICKER_ITEM + (rows - 1) * PICKER_GAP};
}
export function getPickerItemRect(index: number) {
  const row = Math.floor(index / PICKER_PER_ROW);
  const col = index % PICKER_PER_ROW;
  return {
    x: PICKER_X + PICKER_PAD + col * (PICKER_ITEM + PICKER_GAP),
    y: PICKER_Y + PICKER_PAD + row * (PICKER_ITEM + PICKER_GAP),
    w: PICKER_ITEM, h: PICKER_ITEM,
  };
}

export function colorForFill(hex: string): string {
  if (typeof hex === 'string' && hex.toLowerCase() === '#ffffff') return 'white';
  return hex;
}

export function contrastColor(hex: string): string {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? 'black' : 'white';
}
