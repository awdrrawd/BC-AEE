// Slot model: creates the SLOT_COUNT draw slots (each backing a board
// canvas + undo stack), tracks which one is currently being edited (`A`),
// and owns the primitives that operate directly on a slot's own canvas
// (undo/clear, item lookup, composite caching).

import {DRAW_GROUPS, DRAW_ASSET, SLOT_COUNT, BOARD_W, BOARD_H, MASK_IMG_W, MASK_IMG_H, MASK_PRIORITY} from '../constants';
import {bustMaskTexture} from '../masking';
import type {Slot} from './types';

function makeSlot(i: number): Slot {
  const c = document.createElement('canvas');
  c.width = BOARD_W; c.height = BOARD_H;
  return {
    index: i,
    group: DRAW_GROUPS[i],
    maskGroup: (DRAW_GROUPS[i] + 'Mask') as unknown as AssetGroupName,
    maskAsset: DRAW_GROUPS[i] + 'MaskA',
    visGroup: (DRAW_GROUPS[i] + 'Vis') as unknown as AssetGroupName,
    visAsset: DRAW_GROUPS[i] + 'VisA',
    canvas: c,
    ctx: c.getContext('2d')!,
    offsetX: 0, offsetY: 0, rotation: 0, scale: 1,
    isMask: false,
    maskPriority: MASK_PRIORITY,
    undoStack: [],
    sessionSnapshot: null,
    sessionState: null,
  };
}
export const slots: Slot[] = [];
for (let i = 0; i < SLOT_COUNT; i++) slots.push(makeSlot(i));

// The slot currently open in the extended-item editor, or null. Other
// modules read this live binding directly (`import {A} from './slots'`);
// only this module reassigns it, via setActiveSlot.
export let A: Slot | null = null;
export function setActiveSlot(slot: Slot | null) {
  A = slot;
}

export function slotComposite(slot: Slot): string {
  if (slot._composite) return slot._composite;
  const c = document.createElement('canvas');
  c.width = MASK_IMG_W; c.height = MASK_IMG_H;
  c.getContext('2d')!.drawImage(slot.canvas, slot.offsetX, slot.offsetY, MASK_IMG_W, MASK_IMG_H);
  slot._composite = c.toDataURL('image/png');
  return slot._composite;
}
export function invalidateSlot(slot: Slot) {
  slot._composite = null;
  bustMaskTexture();
}

export function findSlotItem(C: Character | null, slot: Slot): Item | null {
  if (!C || !Array.isArray(C.Appearance)) return null;
  return C.Appearance.find(it => it.Asset?.Group?.Name === slot.group && it.Asset?.Name === DRAW_ASSET) || null;
}

// ---- Undo stack + basic canvas ops (operate on the active slot A) --------

export function pushUndo() {
  if (!A) return;
  A.undoStack.push(A.ctx.getImageData(0, 0, BOARD_W, BOARD_H));
  if (A.undoStack.length > 20) A.undoStack.shift();
}
export function undo() {
  if (!A || !A.undoStack.length) return;
  A.ctx.putImageData(A.undoStack.pop()!, 0, 0);
}
export function clearBoard() {
  if (!A) return;
  pushUndo();
  A.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
}
