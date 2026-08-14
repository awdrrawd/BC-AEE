// Free-draw ×3. Each slot = TWO assets:
//   - DrawingBoard (plain Extended item, in ItemCanvasN) → our drawing editor.
//     The drawing itself lives in its Property.CustomDraw (compressed dataURL).
//   - Mask companion (ItemCanvasNMask, hidden group) → destination-out hiding.
//
// The VISIBLE drawing is painted PER-CHARACTER in a DrawCharacter hook
// (renderOverlay), decoding each character's own Property.CustomDraw. We do NOT
// use a real image layer for it: BC caches a layer's GL texture by URL globally,
// so every character sharing the asset would show one image and remote viewers
// couldn't see per-character drawings. The manual overlay reads each character's
// synced Property, so other AEE players see everyone's drawings.
//
// Transforms are self-contained: move = offsetX/Y (drag with the 位移 mode or
// the arrow buttons); rotate/scale/mirror bake into the board-canvas pixels.
// Mask priority is left to the game's own layering (default 99).
//
// The implementation is split across sibling files by responsibility:
//   types.ts        - shared Slot/AnyProps/Box types
//   slots.ts         - the Slot model, active-slot ref, undo stack, composite cache
//   editorState.ts   - shared toolbar/tool UI state
//   geometry.ts       - board<->screen coordinate math, picker layout, color helpers
//   overlay.ts        - per-character overlay + mask-shape compositing (renderOverlay)
//   registration.ts   - BC asset/group registration for board+mask+vis companions
//   maskToggle.ts     - mask on/off, mask priority, visible-companion sync, room sync
//   editing.ts        - shared "an edit just happened" hook
//   selection.ts      - the box-select ("選取") tool
//   input.ts          - pointer event handling (draw/erase/bucket/text/move/sliders)
//   transform.ts      - rotate/scale/flip baked into the canvas
//   lifecycle.ts       - extended-item load/exit/init, enter/leave/cancel/apply
//   ui.ts             - toolbar drawing + click routing

import {SLOT_COUNT, DRAW_GROUPS, DRAW_ASSET, VIS_SLOTS} from '../constants';
import {slots} from './slots';
import {slotLoad, slotExit, slotInit, syncSlots} from './lifecycle';
import {slotDraw, slotClick, onKeyDown} from './ui';
import {beginVisFrame, visAfterDraw, renderOverlay} from './overlay';
import {cacheDrawArgs} from './geometry';
import {registerFreeDrawGroups, applyFreeDrawNames} from './registration';

export {registerFreeDrawGroups, applyFreeDrawNames, syncSlots, cacheDrawArgs, beginVisFrame, renderOverlay};

export function installFreeDrawCallbacks() {
  const g = globalThis as unknown as Record<string, unknown>;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const prefix = `Inventory${DRAW_GROUPS[i]}${DRAW_ASSET}`;
    g[`${prefix}Load`] = () => { try { slotLoad(i); } catch (e) { console.error('[AEE Mask] Load 錯誤：', e); } };
    g[`${prefix}Draw`] = () => { try { slotDraw(); } catch (e) { console.error('[AEE Mask] Draw 錯誤：', e); } };
    g[`${prefix}Click`] = () => { try { slotClick(); } catch (e) { console.error('[AEE Mask] Click 錯誤：', e); } };
    g[`${prefix}Exit`] = () => { try { slotExit(); } catch (e) { console.error('[AEE Mask] Exit 錯誤：', e); } };
    g[`${prefix}Init`] = (C: Character, Item: Item, Push?: boolean, Refresh?: boolean) => slotInit(i, C, Item, Push, Refresh);
    // Visible-drawing companion's DynamicAfterDraw hook (VIS_SLOTS only): BC
    // calls Assets{Group}{Asset}AfterDraw during that layer's draw.
    if (VIS_SLOTS.has(i)) {
      const slot = slots[i];
      g[`Assets${slot.visGroup}${slot.visAsset}AfterDraw`] = (data: DynamicDrawingData) => visAfterDraw(slot, data);
    }
  }
  window.addEventListener('keydown', onKeyDown);
}
