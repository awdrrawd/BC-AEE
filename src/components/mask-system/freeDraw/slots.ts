// Slot model: creates the SLOT_COUNT draw slots (each backing a board
// canvas + undo stack), tracks which one is currently being edited (`A`),
// and owns the primitives that operate directly on a slot's own canvas
// (undo/clear, item lookup, composite caching).

import {DRAW_GROUPS, DRAW_ASSET, SLOT_COUNT, BOARD_W, BOARD_H, MASK_IMG_W, MASK_IMG_H, MASK_PRIORITY} from '../constants';
import {bustMaskTexture} from '../masking';
import type {Slot, SlotEditSession, SlotSessionPhase, SlotSessionState} from './types';

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
    redoStack: [],
  };
}
export const slots: Slot[] = [];
for (let i = 0; i < SLOT_COUNT; i++) slots.push(makeSlot(i));

// Compatibility view of the explicit editor session. New asynchronous code
// must retain SlotEditSession instead of comparing this slot-only binding.
export let A: Slot | null = null;
let sessionSequence = 0;
let activeSession: SlotEditSession | null = null;

export function beginEditSession(slot: Slot, character: Character, item: Item): SlotEditSession {
  if (activeSession) throw new Error('free_draw_session_already_active');
  slot.undoStack.length = 0;
  slot.redoStack.length = 0;
  slot.loading = true;
  A = slot;
  activeSession = {
    id: ++sessionSequence,
    slot,
    character,
    item,
    phase: 'loading',
    dirty: false,
    hasDrawing: false,
    snapshot: null,
    initialState: null,
  };
  return activeSession;
}

export function getActiveSession(): SlotEditSession | null {
  return activeSession;
}

export function isCurrentSession(session: SlotEditSession | null | undefined): session is SlotEditSession {
  return !!session && activeSession === session;
}

export function activateEditSession(
  session: SlotEditSession,
  snapshot: ImageData,
  initialState: SlotSessionState,
  hasDrawing: boolean,
): boolean {
  if (!isCurrentSession(session)) return false;
  session.snapshot = snapshot;
  session.initialState = initialState;
  session.hasDrawing = hasDrawing;
  session.phase = 'editing';
  session.slot.loading = false;
  return true;
}

export function setSessionPhase(session: SlotEditSession, phase: SlotSessionPhase): boolean {
  if (!isCurrentSession(session)) return false;
  session.phase = phase;
  session.slot.loading = phase !== 'editing';
  return true;
}

export function markSessionDirty(slot: Slot, hasDrawing?: boolean) {
  if (!activeSession || activeSession.slot !== slot || activeSession.phase !== 'editing') return;
  activeSession.dirty = true;
  if (hasDrawing !== undefined) activeSession.hasDrawing = hasDrawing;
}

export function isEditorInteractive(): boolean {
  return !!activeSession && activeSession.phase === 'editing';
}

export function isSessionPreviewReady(session: SlotEditSession | null): session is SlotEditSession {
  return !!session && (session.phase === 'editing' || session.phase === 'saving');
}

export function endEditSession(session: SlotEditSession): boolean {
  if (!isCurrentSession(session)) return false;
  session.phase = 'closing';
  session.slot.loading = false;
  session.slot.undoStack.length = 0;
  session.slot.redoStack.length = 0;
  activeSession = null;
  A = null;
  return true;
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

export function slotHasDrawing(slot: Slot): boolean {
  const pixels = slot.ctx.getImageData(0, 0, BOARD_W, BOARD_H).data;
  for (let alpha = 3; alpha < pixels.length; alpha += 4) {
    if (pixels[alpha] !== 0) return true;
  }
  return false;
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
  A.redoStack.length = 0; // a new edit invalidates anything that was undone
}
// undo/redo are symmetric: each pops its own stack and pushes the CURRENT board
// onto the other, so they can be alternated indefinitely.
export function undo() {
  if (!A || !A.undoStack.length) return;
  A.redoStack.push(A.ctx.getImageData(0, 0, BOARD_W, BOARD_H));
  A.ctx.putImageData(A.undoStack.pop()!, 0, 0);
}
export function redo() {
  if (!A || !A.redoStack.length) return;
  A.undoStack.push(A.ctx.getImageData(0, 0, BOARD_W, BOARD_H));
  A.ctx.putImageData(A.redoStack.pop()!, 0, 0);
}
export function clearBoard() {
  if (!A) return;
  pushUndo();
  A.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
}

// Stroke scratch layer. Pen/eraser segments are drawn here at FULL opacity and
// composited onto the board once, on release — drawing them straight onto the
// board with a partial alpha would double-composite every overlapping segment
// join and bead the stroke. One shared canvas: only one stroke exists at a time.
export const scratch = document.createElement('canvas');
scratch.width = BOARD_W; scratch.height = BOARD_H;
export const scratchCtx = scratch.getContext('2d')!;

// Board+scratch composited for the editor preview. It has to happen offscreen:
// the eraser's blend is destination-out, and applying that straight to
// MainCanvas would cut through the character and background sitting under the
// board, instead of only through the drawing.
export const preview = document.createElement('canvas');
preview.width = BOARD_W; preview.height = BOARD_H;
export const previewCtx = preview.getContext('2d')!;
