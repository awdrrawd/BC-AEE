// Extended-item callbacks: loading a slot's canvas from its saved Property,
// entering/exiting the editor, reverting on cancel, and baking the drawing +
// transforms into the character's Property on accept.

import type {AnyProps, Slot} from './types';
import {PROP_KEY, BOARD_W, BOARD_H} from '../constants';
import {A, setActiveSlot, slots, invalidateSlot, findSlotItem} from './slots';
import {State, resetSelection} from './editorState';
import {
  isSlotMasked, applyMaskPriority, syncVisCompanion, loadMaskPriority,
  slotSyncGroups, syncCharacterToRoom, PROP_MASK_PRIO,
} from './maskToggle';
import {attachListeners, detachListeners} from './input';
import {t} from '@/i18n/i18n';
import {commitSelection} from './selection';

function safeCurrentCharacter(): Character | null {
  try {
    if (typeof CharacterGetCurrent === 'function') return CharacterGetCurrent() || null;
  } catch { /* CurrentCharacter is not initialized outside character screens */ }
  return typeof Player !== 'undefined' ? Player : null;
}

function ensureSlotCanvasFromProperty(slot: Slot, item: Item | null): Promise<void> {
  const p = item && item.Property ? (item.Property as AnyProps) : null;
  const compressed = p ? (p[PROP_KEY] as string | undefined) : undefined;
  const sig = compressed ? (compressed.length + ':' + compressed.slice(0, 16)) : '';
  if (slot._loadedSig === sig) return Promise.resolve();
  if (slot._loadingSig === sig && slot._loadPromise) return slot._loadPromise;
  const token = (slot._loadToken ?? 0) + 1;
  slot._loadToken = token;
  slot.offsetX = (p?.OffsetX as number) || 0;
  slot.offsetY = (p?.OffsetY as number) || 0;
  if (!compressed) {
    slot.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    invalidateSlot(slot);
    slot._loadedSig = sig;
    return Promise.resolve();
  }
  const dataUrl = typeof LZString !== 'undefined' ? (LZString.decompressFromBase64(compressed) || compressed) : compressed;
  slot._loadingSig = sig;
  const promise = new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => {
      if (slot._loadToken === token) {
        slot.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
        slot.ctx.drawImage(img, 0, 0, BOARD_W, BOARD_H);
        slot._loadedSig = sig;
        invalidateSlot(slot);
        const C = safeCurrentCharacter();
        if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
      }
      if (slot._loadToken === token) {
        slot._loadingSig = undefined;
        slot._loadPromise = undefined;
      }
      resolve();
    };
    img.onerror = () => {
      if (slot._loadToken === token) {
        slot._loadedSig = undefined;
        slot._loadingSig = undefined;
        slot._loadPromise = undefined;
      }
      resolve();
    };
    img.src = dataUrl;
  });
  slot._loadPromise = promise;
  return promise;
}

// Keep the LOCAL player's board canvases current (they feed the editor + the
// mask-companion shape). Remote characters render via renderOverlay from their
// own Property, so we don't thrash the shared slot canvas with their drawings.
export function syncSlots(C: Character | null) {
  if (!C || C !== Player || !Array.isArray(C.Appearance)) return;
  let priorityChanged = false;
  for (const slot of slots) {
    const item = findSlotItem(C, slot);
    if (item) ensureSlotCanvasFromProperty(slot, item);
    // Keep the remembered priority + the worn companion's OverridePriority in
    // sync (e.g. after a relog restored the board but a fresh companion). Skip
    // the slot being edited — this runs every frame, and reloading its stored
    // value would clobber an in-progress slider drag (the value snapping back
    // each frame is what made the drag feel stuck/laggy).
    if (A !== slot) {
      loadMaskPriority(slot, item);
      if (isSlotMasked(C, slot)) priorityChanged = applyMaskPriority(C, slot) || priorityChanged;
    }
    syncVisCompanion(C, slot); // wear/remove the visible companion (VIS_SLOTS)
  }
  // CharacterLoadCanvas snapshots Appearance into DrawAppearance, then builds
  // AppearanceLayers/AppearanceMasks from that snapshot.  Merely repairing a
  // companion's OverridePriority after login therefore leaves the already-built
  // layer order and mask cache stale until some unrelated wardrobe action
  // happens to refresh the character. Rebuild once when the repair changed a
  // value so the remembered slider setting takes effect immediately.
  if (priorityChanged && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
}

export async function slotLoad(i: number) {
  setActiveSlot(slots[i]);
  const active = slots[i];
  active.loading = true;
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  active.isMask = isSlotMasked(C, active);
  const item = DialogFocusItem;
  loadMaskPriority(active, item);
  if (item && item.Property) {
    const p = item.Property as AnyProps;
    active.offsetX = (p.OffsetX as number) || 0;
    active.offsetY = (p.OffsetY as number) || 0;
  }
  await ensureSlotCanvasFromProperty(active, item);
  if (A !== active) return;
  active.sessionSnapshot = active.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  active.sessionState = {offsetX: active.offsetX, offsetY: active.offsetY, rotation: active.rotation, scale: active.scale, isMask: active.isMask, maskPriority: active.maskPriority};
  State.picker = null;
  resetSelection(); // stale selection from a previous slot/session must not carry over
  if (State.tool === 'move' || State.tool === 'select') State.tool = 'pen';
  invalidateSlot(active);
  active.loading = false;
  attachListeners();
  if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
  DialogExtendedMessage = t('free-draw-hint');
}

export function slotExit() {
  if (A) A.loading = false;
  detachListeners();
}

export function slotInit(_i: number, C: Character, Item: Item, Push = true, Refresh = true): boolean {
  if (!CommonIsObject(Item.Property)) Item.Property = {};
  if (Refresh) CharacterRefresh(C, Push, false);
  return false;
}

export function leaveEditor() {
  commitSelection(); // don't silently drop a floating piece if exited via Escape
  detachListeners();
  const editing = A;
  if (typeof DialogLeaveFocusItem === 'function') {
    DialogLeaveFocusItem();
  } else if (typeof ExtendedItemExit === 'function') {
    ExtendedItemExit();
    DialogFocusItem = null;
    (globalThis as unknown as Record<string, unknown>).DialogFocusItemName = null;
    DialogExtendedMessage = '';
  }
  setActiveSlot(null);
  if (editing) {
    invalidateSlot(editing);
    const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
  }
}

export function cancelEditingAndExit() {
  resetSelection(); // discard the floating piece too — the whole edit is being reverted
  if (A) {
    if (A.sessionSnapshot) A.ctx.putImageData(A.sessionSnapshot, 0, 0);
    const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    if (A.sessionState) {
      A.offsetX = A.sessionState.offsetX;
      A.offsetY = A.sessionState.offsetY;
      A.rotation = A.sessionState.rotation;
      A.scale = A.sessionState.scale;
      // Mask toggles / priority are applied to the character live during a
      // session, so reverting them must also be pushed — otherwise the room
      // (and another edited character's server state) keeps the un-reverted value.
      const maskChanged = !!C && isSlotMasked(C, A) !== A.sessionState.isMask;
      const prioChanged = A.maskPriority !== A.sessionState.maskPriority;
      if (maskChanged) {
        if (A.sessionState.isMask) { invalidateSlot(A); InventoryWear(C, A.maskAsset, A.maskGroup, null, null, null, null as never, false); }
        else InventoryRemove(C, A.maskGroup, false);
      }
      A.isMask = A.sessionState.isMask;
      A.maskPriority = A.sessionState.maskPriority;
      if (C && A.isMask) applyMaskPriority(C, A); // revert the live-dragged priority
      if (C && (maskChanged || prioChanged)) { CharacterRefresh(C, true, false); syncCharacterToRoom(C, ...slotSyncGroups(A)); }
    }
    A.undoStack = [];
    A.redoStack = [];
  }
  State.picker = null;
  leaveEditor();
}

export function applyToCharacter() {
  commitSelection(); // defensive: make sure the saved PNG includes the floating piece
  if (!A) return;
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  if (!C) return;
  const item = findSlotItem(C, A) || InventoryGet(C, A.group);
  if (!item) return;

  const dataUrl = A.canvas.toDataURL('image/png');
  const compressed = typeof LZString !== 'undefined' ? LZString.compressToBase64(dataUrl) : dataUrl;
  if (!CommonIsObject(item.Property)) item.Property = {};
  const p = item.Property as AnyProps;
  p[PROP_KEY] = compressed;
  p.OffsetX = A.offsetX;
  p.OffsetY = A.offsetY;
  p[PROP_MASK_PRIO] = A.maskPriority;
  A._loadedSig = compressed.length + ':' + compressed.slice(0, 16);

  // Ensure the visible companion (VIS_SLOTS) reflects the new drawing on THIS
  // character before we broadcast — syncSlots only runs for the local player, so
  // when editing someone else nothing would otherwise wear/remove it on them.
  syncVisCompanion(C, A);
  applyMaskPriority(C, A);
  invalidateSlot(A);
  CharacterRefresh(C, true, false); // Push=true → persist to account DB (self only)
  syncCharacterToRoom(C, ...slotSyncGroups(A)); // broadcast board (+ mask/vis) to the room
}
