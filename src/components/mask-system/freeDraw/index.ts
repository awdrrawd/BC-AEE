// Free-draw ×3. Each slot = THREE assets:
//   - DrawingBoard (NOARCH extended item, in ItemCanvasN) → our drawing editor.
//     The drawing itself lives in its Property.CustomDraw (compressed dataURL).
//   - Mask companion (ItemCanvasNMask, hidden group) → destination-out hiding.
//   - Vis companion (ItemCanvasNVis, hidden group) → real sortable draw layer.
//
// Both companions obtain their per-character texture from MaskImageProviders;
// renderOverlay primes decoded-image/composite caches for those providers.
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
//   extendedConfig.ts - R132 property defaults and extended-item callbacks
//   maskToggle.ts     - mask on/off, mask priority, visible-companion sync, room sync
//   editing.ts        - shared "an edit just happened" hook
//   selection.ts      - the box-select ("選取") tool
//   input.ts          - pointer event handling (draw/erase/bucket/text/move/sliders)
//   transform.ts      - rotate/scale/flip baked into the canvas
//   lifecycle.ts       - extended-item load/exit, enter/leave/cancel/apply
//   ui.ts             - toolbar drawing + click routing

import {syncSlots} from './lifecycle';
import {onKeyDown} from './ui';
import {renderOverlay} from './overlay';
import {cacheDrawArgs} from './geometry';
import {registerFreeDrawGroups, applyFreeDrawNames, setFreeDrawAvailability} from './registration';

export {registerFreeDrawGroups, applyFreeDrawNames, setFreeDrawAvailability, syncSlots, cacheDrawArgs, renderOverlay};

export function installFreeDrawCallbacks() {
  // Item callbacks are registered through the NOARCH config, including after
  // AssetLoadAll. Only the shared keyboard listener needs one-time setup.
  window.addEventListener('keydown', onKeyDown);
}
