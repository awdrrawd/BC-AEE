// Mask toggle & companion sync: wearing/removing the hidden mask companion,
// keeping the visible-drawing companion (VIS_SLOTS) in sync with whether the
// slot has a drawing and isn't masked, the remembered mask "順位"/priority,
// and broadcasting worn-item changes to the room.

import type {AnyProps, Slot} from './types';
import {VIS_SLOTS, PROP_KEY, MPRIO_MIN, MPRIO_MAX, MPRIO_BAR_X, MPRIO_BAR_W, MASK_PRIORITY} from '../constants';
import {A, invalidateSlot, findSlotItem} from './slots';

// Property key on the DrawingBoard item that remembers this slot's mask
// priority across on/off toggles + reloads (and syncs to other players).
export const PROP_MASK_PRIO = 'MaskPriority';

export function isSlotMasked(C: Character | null, slot: Slot): boolean {
  return !!(C && InventoryGet(C, slot.maskGroup));
}

// Propagate an appearance change to the rest of the chatroom. No-op outside a
// chatroom (there the caller's CharacterRefresh(Push) already saved to the DB).
//
// SELF: ChatRoomCharacterUpdate(Player) pushes the whole appearance; the server
// accepts it because it carries the player's own CharacterID.
//
// ANOTHER CHARACTER (A editing B): the server DROPS a ChatRoomCharacterUpdate
// that carries B's CharacterID coming from A — only B may push B's full
// appearance (and CharacterRefresh(B, Push) doesn't even sync, since B isn't the
// player). THAT is why the drawing only appeared after B re-saved in the
// wardrobe. BC's sanctioned path for one member changing another's item is
// ChatRoomCharacterItemUpdate(C, group): it targets B.MemberNumber, patches
// ChatRoomData so a later sync won't revert it, and broadcasts to the room. We
// send one update per group we actually touched (board / mask / vis companions).
export function syncCharacterToRoom(C: Character | null, ...groups: (AssetGroupName | string)[]) {
  if (!C) return;
  if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') return;
  const isPlayer = typeof C.IsPlayer === 'function' ? C.IsPlayer() : (typeof Player !== 'undefined' && C === Player);
  try {
    if (isPlayer) {
      if (typeof ChatRoomCharacterUpdate === 'function') ChatRoomCharacterUpdate(C);
      return;
    }
    if (typeof ChatRoomCharacterItemUpdate !== 'function') return;
    const seen = new Set<string>();
    for (const g of groups) {
      const name = g as unknown as string;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      try { ChatRoomCharacterItemUpdate(C, g as AssetGroupName); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

// Groups whose worn item can change for a slot: the board itself, its mask
// companion, and (VIS_SLOTS only) the visible-drawing companion.
export function slotSyncGroups(slot: Slot): (AssetGroupName | string)[] {
  const gs: (AssetGroupName | string)[] = [slot.group, slot.maskGroup];
  if (VIS_SLOTS.has(slot.index)) gs.push(slot.visGroup);
  return gs;
}

// Push the slot's priority onto the WORN companion(s) as OverridePriority. BC
// uses it as that layer's priority: for the mask (ApplyToAbove:false → masks
// only clothing below it) and, for VIS_SLOTS, for the visible-drawing layer
// (so the 順位 slider reorders the drawing itself).
export function applyMaskPriority(C: Character | null, slot: Slot): boolean {
  if (!C) return false;
  let changed = false;
  const setOn = (item: Item | null) => {
    if (!item) return;
    if (!CommonIsObject(item.Property)) item.Property = {};
    if ((item.Property as AnyProps).OverridePriority === slot.maskPriority) return;
    (item.Property as AnyProps).OverridePriority = slot.maskPriority;
    changed = true;
  };
  setOn(InventoryGet(C, slot.maskGroup));
  if (VIS_SLOTS.has(slot.index)) setOn(InventoryGet(C, slot.visGroup));
  return changed;
}

// Wear/remove the visible companion (VIS_SLOTS) so it's worn exactly when the
// slot has a drawing. Mask mode does not remove it: the separate mask companion
// cuts the selected clothing while this layer keeps the stroke visible.
let visRefreshPending = false;
export function syncVisCompanion(C: Character | null, slot: Slot) {
  if (!C || !VIS_SLOTS.has(slot.index)) return;
  const board = findSlotItem(C, slot);
  const hasDraw = !!(board?.Property as AnyProps | undefined)?.[PROP_KEY];
  // The visible drawing and its mask are independent layers. Keep the visible
  // companion worn in mask mode too, so enabling the mask cuts clothing while
  // the stroke itself remains visible at the same selected priority.
  const shouldWear = hasDraw;
  const worn = !!InventoryGet(C, slot.visGroup);
  if (shouldWear === worn) { if (worn) applyMaskPriority(C, slot); return; }
  if (shouldWear) {
    InventoryWear(C, slot.visAsset, slot.visGroup, null, null, null, null as never, false);
    applyMaskPriority(C, slot);
  } else {
    InventoryRemove(C, slot.visGroup, false);
  }
  if (!visRefreshPending) {
    visRefreshPending = true;
    setTimeout(() => { visRefreshPending = false; try { CharacterRefresh(C, true, false); } catch { /* ignore */ } }, 0);
  }
}

// Read the remembered priority off the DrawingBoard item (default 99).
export function loadMaskPriority(slot: Slot, boardItem: Item | null) {
  const p = boardItem?.Property as AnyProps | undefined;
  const v = p?.[PROP_MASK_PRIO];
  slot.maskPriority = typeof v === 'number' ? v : MASK_PRIORITY;
}

export function toggleSlotMask() {
  if (!A) return;
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  if (!C) return;
  if (isSlotMasked(C, A)) {
    InventoryRemove(C, A.maskGroup, false);
    A.isMask = false;
  } else {
    InventoryWear(C, A.maskAsset, A.maskGroup, null, null, null, null as never, false);
    applyMaskPriority(C, A); // honour the remembered priority on the fresh companion
    A.isMask = true;
  }
  invalidateSlot(A);
  // Push=true saves to the account DB (self); the room broadcast propagates the
  // worn/removed mask companion — incl. when editing another character.
  CharacterRefresh(C, true, false);
  syncCharacterToRoom(C, A.maskGroup);
}

// Live-update during a priority-slider drag: ONLY move the value (cheap, like
// the stroke slider) so dragging stays smooth. The heavy mask rebuild happens
// once on release — see commitMaskPriority.
export function updatePriorityFromPointerX(cx: number) {
  if (!A) return;
  const ratio = Math.min(1, Math.max(0, (cx - MPRIO_BAR_X) / MPRIO_BAR_W));
  A.maskPriority = Math.round(MPRIO_MIN + ratio * (MPRIO_MAX - MPRIO_MIN));
}

// On release: apply to the worn companion, persist to the DrawingBoard item,
// rebuild once + push-sync so others get it.
export function commitMaskPriority() {
  if (!A) return;
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  const board = C ? findSlotItem(C, A) : null;
  if (board) {
    if (!CommonIsObject(board.Property)) board.Property = {};
    (board.Property as AnyProps)[PROP_MASK_PRIO] = A.maskPriority;
  }
  applyMaskPriority(C, A);
  invalidateSlot(A);
  if (C) { CharacterRefresh(C, true, false); syncCharacterToRoom(C, ...slotSyncGroups(A)); }
}
