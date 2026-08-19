// Live estimate of the target character's serialized Appearance size, shown
// in the free-draw editor as a heads-up before BC's AccountUpdate /
// ChatRoomCharacterUpdate byte ceiling rejects the sync — the error players
// hit most often after importing a large image into a drawing board, since a
// detailed drawing inflates the compressed PNG stored in the item's
// Property.CustomDraw. We don't block it (per design), just surface the
// number so there's some psychological pressure before it happens.
//
// The currently-open slot hasn't written its canvas back to Property yet
// (that only happens on Accept — see applyToCharacter in lifecycle.ts), so a
// plain read of C.Appearance would sit frozen while the player draws or
// imports an image — exactly the moment this needs to move. We splice in
// what that slot's Property WOULD be if Accept were pressed right now.

import {bundleAppearance} from '@/util/appearanceBundle';
import {PROP_KEY} from '../constants';
import type {AnyProps} from './types';
import {A, findSlotItem} from './slots';
import {safeCurrentCharacter} from './currentCharacter';

// Mirrors the ~180KB ceiling BC's server enforces on the serialized payload
// that carries Appearance — past this, saving/broadcasting starts throwing
// instead of going through. Not exposed as a hard block here; see the
// module-level note above.
export const APPEARANCE_SIZE_BUDGET = 180000;

function projectedAppearance(C: Character): readonly Item[] {
  if (!A) return C.Appearance;
  const item = findSlotItem(C, A) || (typeof InventoryGet === 'function' ? InventoryGet(C, A.group) : null);
  if (!item) return C.Appearance;
  let compressed: string;
  try {
    const dataUrl = A.canvas.toDataURL('image/png');
    compressed = typeof LZString !== 'undefined' ? LZString.compressToBase64(dataUrl) : dataUrl;
  } catch {
    return C.Appearance; // canvas unavailable/tainted — fall back to the last-saved size
  }
  const property: AnyProps = {...(item.Property as AnyProps | undefined), [PROP_KEY]: compressed};
  return C.Appearance.map(it => (it === item ? {...it, Property: property} : it));
}

function measure(C: Character): number {
  try {
    return new TextEncoder().encode(JSON.stringify(bundleAppearance(projectedAppearance(C)))).byteLength;
  } catch {
    return 0;
  }
}

// toDataURL() re-encodes the whole board canvas, so this isn't quite free —
// throttle it. The readout only needs to feel live, not track every stroke.
const THROTTLE_MS = 400;
let cachedUsed = 0;
let cachedAt = 0;

/** Current {used, budget} in bytes. Recomputed at most every THROTTLE_MS. */
export function targetAppearanceUsage(): {used: number; budget: number} {
  const C = safeCurrentCharacter();
  if (!C) return {used: cachedUsed, budget: APPEARANCE_SIZE_BUDGET};
  const now = Date.now();
  if (now - cachedAt >= THROTTLE_MS) {
    cachedUsed = measure(C);
    cachedAt = now;
  }
  return {used: cachedUsed, budget: APPEARANCE_SIZE_BUDGET};
}

/** e.g. 86000 -> "86K", 4200 -> "4.2K". */
export function formatBytesK(bytes: number): string {
  const k = bytes / 1000;
  return `${k < 10 ? k.toFixed(1) : Math.round(k)}K`;
}
