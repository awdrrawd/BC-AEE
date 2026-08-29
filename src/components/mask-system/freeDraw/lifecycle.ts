// Extended-item callbacks: loading a slot's canvas from its saved Property,
// entering/exiting the editor, reverting on cancel, and baking the drawing +
// transforms into the character's Property on accept.

import type {AnyProps, Slot, SlotEditSession} from './types';
import {PROP_KEY, PROP_SPS_KEY, BOARD_W, BOARD_H} from '../constants';
import {
  A, activateEditSession, beginEditSession, endEditSession, findSlotItem,
  getActiveSession, invalidateSlot, isCurrentSession, isSessionPreviewReady,
  setSessionPhase, slotHasDrawing, slots,
} from './slots';
import {State, resetSelection} from './editorState';
import {
  isSlotMasked, applyMaskPriority, cancelMaskPriorityPreview, syncVisCompanion, loadMaskPriority,
  slotSyncGroups, syncCharacterToRoom, PROP_MASK_PRIO,
} from './maskToggle';
import {attachListeners, detachListeners} from './input';
import {t} from '@/i18n/i18n';
import {commitSelection} from './selection';
import {safeCurrentCharacter} from './currentCharacter';
import {
  downloadSpsDrawing, readDrawRef, resolveSpsDrawUrl, uploadSpsBlob, uploadSpsDrawing,
  type SpsDrawRef,
} from './spsDrawing';
import {showToast} from '@/util/toast';
import {askConfirm} from '@/core/prompts';
import {
  APPEARANCE_HARD_BYTES, APPEARANCE_UPLOAD_BYTES, canvasEmbeddedData,
  formatBytesK, projectedAppearanceBytes,
} from './appearanceSize';

async function ensureSlotCanvasFromProperty(slot: Slot, item: Item | null, target: Character): Promise<boolean> {
  const p = item && item.Property ? (item.Property as AnyProps) : null;
  const compressed = p ? (p[PROP_KEY] as string | undefined) : undefined;
  const remote = readDrawRef(p ?? undefined);
  // Exact content identity: PNG/LZ payloads share long prefixes, so a short
  // prefix plus length can alias two different drawings and retain stale pixels.
  const sig = compressed || (remote ? `sps:${remote.o}:${remote.s}:${remote.r}` : '');
  slot.offsetX = (p?.OffsetX as number) || 0;
  slot.offsetY = (p?.OffsetY as number) || 0;
  if (slot._loadedSig === sig) return true;
  if (slot._loadingSig === sig && slot._loadPromise) return slot._loadPromise;
  const token = (slot._loadToken ?? 0) + 1;
  slot._loadToken = token;
  slot._loadingSig = sig;
  // Never expose pixels belonging to the previous item while a new source is
  // resolving. The editor overlay remains property-backed until activation.
  slot.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  invalidateSlot(slot);
  if (!compressed && !remote) {
    slot._loadedSig = sig;
    slot._loadingSig = undefined;
    return true;
  }
  const promise = (async () => {
    try {
      const dataUrl = compressed
        ? (typeof LZString !== 'undefined' ? (LZString.decompressFromBase64(compressed) || compressed) : compressed)
        : await resolveSpsDrawUrl(p ?? undefined);
      if (!dataUrl || slot._loadToken !== token) return false;
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const value = new Image();
        value.onload = () => resolve(value);
        value.onerror = () => reject(new Error('free_draw_decode_failed'));
        value.src = dataUrl;
      });
      if (slot._loadToken !== token) return false;
      slot.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
      slot.ctx.drawImage(img, 0, 0, BOARD_W, BOARD_H);
      slot._loadedSig = sig;
      invalidateSlot(slot);
      if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(target);
      return true;
    } catch (error) {
      if (slot._loadToken === token) {
        slot.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
        slot._loadedSig = undefined;
        invalidateSlot(slot);
      }
      console.warn('🐈‍⬛ [AEE] Failed to load free drawing', error);
      return false;
    } finally {
      if (slot._loadToken === token) {
        slot._loadingSig = undefined;
        slot._loadPromise = undefined;
      }
    }
  })();
  slot._loadPromise = promise;
  return promise;
}

const adopting = new Set<string>();
const adoptionRetryAt = new Map<string, number>();

async function adoptForeignDrawing(slot: Slot, item: Item): Promise<void> {
  const ref = readDrawRef(item.Property as AnyProps | undefined);
  const owner = Player?.MemberNumber;
  if (!ref || typeof owner !== 'number' || ref.o === owner) return;
  const id = `${ref.o}:${ref.s}:${ref.r}`;
  if (adopting.has(id) || (adoptionRetryAt.get(id) ?? 0) > Date.now()) return;
  adopting.add(id);
  try {
    const blob = await downloadSpsDrawing(ref);
    if (!blob) throw new Error('missing_foreign_drawing');
    const ownRef = await uploadSpsBlob(slot.index, blob);
    const current = readDrawRef(item.Property as AnyProps | undefined);
    if (!current || current.o !== ref.o || current.r !== ref.r) return;
    if (!CommonIsObject(item.Property)) item.Property = {};
    (item.Property as AnyProps)[PROP_SPS_KEY] = ownRef;
    delete (item.Property as AnyProps)[PROP_KEY];
    CharacterRefresh(Player, true, false);
    syncCharacterToRoom(Player, ...slotSyncGroups(slot));
    adoptionRetryAt.delete(id);
    showToast(t('free-draw-sps-adopted'));
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to adopt another player\'s SPS drawing', error);
    adoptionRetryAt.set(id, Date.now() + 60_000);
    showToast(t('free-draw-sps-adopt-failed'), {color: '#f87171', duration: 5000});
  } finally { adopting.delete(id); }
}

// Keep the LOCAL player's board canvases current (they feed the editor + the
// mask-companion shape). Remote characters render via renderOverlay from their
// own Property, so we don't thrash the shared slot canvas with their drawings.
export function syncSlots(C: Character | null) {
  if (!C || C !== Player || !Array.isArray(C.Appearance)) return;
  const session = getActiveSession();
  let needsLocalRebuild = false;
  let needsPersistentRefresh = false;
  for (const slot of slots) {
    const item = findSlotItem(C, slot);
    const slotIsBeingEdited = !!session && session.slot === slot;
    if (item && !slotIsBeingEdited) {
      void ensureSlotCanvasFromProperty(slot, item, C);
      void adoptForeignDrawing(slot, item);
    }
    // Keep the remembered priority + the worn companion's OverridePriority in
    // sync (e.g. after a relog restored the board but a fresh companion). Skip
    // the slot being edited — this runs every frame, and reloading its stored
    // value would clobber an in-progress slider drag (the value snapping back
    // each frame is what made the drag feel stuck/laggy).
    if (A !== slot) {
      loadMaskPriority(slot, item);
      if (isSlotMasked(C, slot)) needsLocalRebuild = applyMaskPriority(C, slot) || needsLocalRebuild;
    }
    // Keep the unsaved live drawing's Vis layer worn while its editor is open;
    // otherwise this per-frame sync would remove it again because CustomDraw is
    // intentionally not persisted until Accept.
    const liveSession = isSessionPreviewReady(session) && session.character === C && session.slot === slot;
    const vis = syncVisCompanion(C, slot, liveSession ? session.hasDrawing : undefined);
    needsLocalRebuild = vis.priorityChanged || needsLocalRebuild;
    if (vis.appearanceChanged) {
      if (liveSession) needsLocalRebuild = true;
      else needsPersistentRefresh = true;
    }
  }
  // CharacterLoadCanvas snapshots Appearance into DrawAppearance, then builds
  // AppearanceLayers/AppearanceMasks from that snapshot.  Merely repairing a
  // companion's OverridePriority after login therefore leaves the already-built
  // layer order and mask cache stale until some unrelated wardrobe action
  // happens to refresh the character. Rebuild once when the repair changed a
  // value so the remembered slider setting takes effect immediately.
  if (needsPersistentRefresh) CharacterRefresh(C, true, false);
  else if (needsLocalRebuild && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
}

export async function slotLoad(i: number) {
  const previous = getActiveSession();
  if (previous) {
    rollbackSession(previous);
    endEditSession(previous);
    cancelMaskPriorityPreview();
  }
  const C = safeCurrentCharacter();
  const active = slots[i];
  const focusedItem = DialogFocusItem;
  const item = C ? (findSlotItem(C, active) || focusedItem) : null;
  if (!C || !item) {
    closeFocusedItem();
    return;
  }
  const session = beginEditSession(active, C, item);
  resetSelection();
  active.isMask = isSlotMasked(C, active);
  active.rotation = 0;
  active.scale = 1;
  loadMaskPriority(active, item);
  const loaded = await ensureSlotCanvasFromProperty(active, item, C);
  if (!isCurrentSession(session)) return;
  if (!loaded) {
    DialogExtendedMessage = t('free-draw-image-failed');
    showToast(DialogExtendedMessage, {color: '#f87171', duration: 5000});
    endEditSession(session);
    closeFocusedItem();
    return;
  }
  const snapshot = active.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  const initialState = {
    offsetX: active.offsetX,
    offsetY: active.offsetY,
    rotation: active.rotation,
    scale: active.scale,
    isMask: active.isMask,
    maskPriority: active.maskPriority,
  };
  if (!activateEditSession(session, snapshot, initialState, slotHasDrawing(active))) return;
  State.picker = null;
  State.priorityPreview = false;
  if (State.tool === 'move' || State.tool === 'select') State.tool = 'pen';
  invalidateSlot(active);
  attachListeners();
  if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
  DialogExtendedMessage = t('free-draw-hint');
}

export function slotExit() {
  const session = getActiveSession();
  if (session) {
    rollbackSession(session);
    endEditSession(session);
  }
  cancelMaskPriorityPreview();
  detachListeners();
}

export function slotInit(_i: number, C: Character, Item: Item, Push = true, Refresh = true): boolean {
  if (!CommonIsObject(Item.Property)) Item.Property = {};
  if (Refresh) CharacterRefresh(C, Push, false);
  return false;
}

function closeFocusedItem() {
  if (typeof DialogLeaveFocusItem === 'function') {
    DialogLeaveFocusItem();
  } else if (typeof ExtendedItemExit === 'function') {
    ExtendedItemExit();
    DialogFocusItem = null;
    (globalThis as unknown as Record<string, unknown>).DialogFocusItemName = null;
    DialogExtendedMessage = '';
  }
}

function rollbackSession(session: SlotEditSession) {
  if (!isCurrentSession(session)) return;
  resetSelection();
  const {slot, character: C, initialState} = session;
  if (session.snapshot) slot.ctx.putImageData(session.snapshot, 0, 0);
  if (initialState) {
    slot.offsetX = initialState.offsetX;
    slot.offsetY = initialState.offsetY;
    slot.rotation = initialState.rotation;
    slot.scale = initialState.scale;
    const currentlyMasked = isSlotMasked(C, slot);
    if (currentlyMasked !== initialState.isMask) {
      if (initialState.isMask) InventoryWear(C, slot.maskAsset, slot.maskGroup, null, null, null, null as never, false);
      else InventoryRemove(C, slot.maskGroup, false);
    }
    slot.isMask = initialState.isMask;
    slot.maskPriority = initialState.maskPriority;
    if (slot.isMask) applyMaskPriority(C, slot);
    syncVisCompanion(C, slot);
  }
  invalidateSlot(slot);
  State.picker = null;
  State.priorityPreview = false;
  if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
}

// Commit-close is deliberately separate from rollback-close. Callers may only
// reach this after applyToCharacter returned true.
export function leaveEditor() {
  const session = getActiveSession();
  if (!session || session.phase !== 'saving') return;
  endEditSession(session);
  cancelMaskPriorityPreview();
  detachListeners();
  invalidateSlot(session.slot);
  if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(session.character);
  closeFocusedItem();
}

export function cancelEditingAndExit() {
  const session = getActiveSession();
  if (!session || session.phase !== 'editing') return;
  rollbackSession(session);
  endEditSession(session);
  cancelMaskPriorityPreview();
  detachListeners();
  closeFocusedItem();
}

export async function applyToCharacter(): Promise<boolean> {
  commitSelection(); // defensive: make sure the saved PNG includes the floating piece
  const session = getActiveSession();
  if (!session || session.phase !== 'editing') return false;
  const {slot, character: C, item} = session;
  if (!setSessionPhase(session, 'saving')) return false;

  const resumeEditing = () => {
    if (isCurrentSession(session)) setSessionPhase(session, 'editing');
  };

  let compressed = '';
  let projected = 0;
  try {
    if (session.hasDrawing && !State.useSps) {
      compressed = canvasEmbeddedData(slot.canvas);
      projected = projectedAppearanceBytes(compressed, session);
    }
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to project free-draw appearance size', error);
    const reason = t('free-draw-save-encode-failed');
    showToast(reason, {color: '#f87171', duration: 5000});
    resumeEditing();
    return false;
  }
  let useSps = State.useSps && session.hasDrawing;
  if (!useSps && projected >= APPEARANCE_UPLOAD_BYTES) {
    useSps = await askConfirm(t('free-draw-size-upload-prompt', {size: formatBytesK(projected)}));
    if (!isCurrentSession(session)) return false;
    if (!useSps) {
      if (projected >= APPEARANCE_HARD_BYTES) {
        const reason = t('free-draw-size-blocked');
        DialogExtendedMessage = reason;
        showToast(reason, {color: '#f87171', duration: 5000});
      }
      resumeEditing();
      return false;
    }
  }

  // The user may have switched to SPS before Accept, in which case embedded
  // encoding was intentionally skipped above.
  if (session.hasDrawing && !useSps && !compressed) {
    resumeEditing();
    return false;
  }

  let remoteRef: SpsDrawRef | undefined;
  if (useSps) {
    const uploadingMessage = t('free-draw-sps-uploading');
    DialogExtendedMessage = uploadingMessage;
    showToast(uploadingMessage, {duration: 5000});
    try {
      remoteRef = await uploadSpsDrawing(slot.index, slot.canvas);
      if (!isCurrentSession(session)) return false;
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to upload free drawing to SPS', error);
      const reason = t(error instanceof Error && error.message === 'freedraw_image_too_large'
        ? 'free-draw-sps-too-large' : 'free-draw-sps-upload-failed');
      DialogExtendedMessage = reason;
      showToast(reason, {color: '#f87171', duration: 5000});
      resumeEditing();
      return false;
    }
    const uploadedMessage = t('free-draw-sps-uploaded');
    DialogExtendedMessage = uploadedMessage;
    showToast(uploadedMessage);
  }
  if (!isCurrentSession(session)) return false;

  const previousProperty = item.Property;
  const nextProperty: AnyProps = CommonIsObject(previousProperty) ? {...previousProperty} : {};
  if (!session.hasDrawing) {
    delete nextProperty[PROP_KEY];
    delete nextProperty[PROP_SPS_KEY];
  } else if (remoteRef) {
    delete nextProperty[PROP_KEY];
    nextProperty[PROP_SPS_KEY] = remoteRef;
  } else {
    nextProperty[PROP_KEY] = compressed;
    delete nextProperty[PROP_SPS_KEY];
  }
  nextProperty.OffsetX = slot.offsetX;
  nextProperty.OffsetY = slot.offsetY;
  nextProperty[PROP_MASK_PRIO] = slot.maskPriority;
  item.Property = nextProperty;
  // Ensure the visible companion (VIS_SLOTS) reflects the new drawing on THIS
  // character before we broadcast — syncSlots only runs for the local player, so
  // when editing someone else nothing would otherwise wear/remove it on them.
  syncVisCompanion(C, slot, session.hasDrawing);
  applyMaskPriority(C, slot);
  invalidateSlot(slot);
  try {
    CharacterRefresh(C, true, false); // Push=true → persist to account DB (self only)
    syncCharacterToRoom(C, ...slotSyncGroups(slot)); // broadcast board (+ mask/vis) to the room
  } catch (error) {
    item.Property = previousProperty;
    syncVisCompanion(C, slot, session.hasDrawing);
    if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
    console.warn('🐈‍⬛ [AEE] Failed to persist free drawing', error);
    resumeEditing();
    return false;
  }
  slot._loadedSig = remoteRef
    ? `sps:${remoteRef.o}:${remoteRef.s}:${remoteRef.r}`
    : compressed;
  return true;
}
