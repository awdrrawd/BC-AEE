// Tiny shared "an edit just happened" hook. Split out on its own because it
// sits between slots.ts (invalidateSlot) and maskToggle.ts (isSlotMasked),
// both of which several other modules need independently of this.

import {A, invalidateSlot} from './slots';
import {safeCurrentCharacter} from './currentCharacter';
import {isSlotMasked} from './maskToggle';

export function afterEdit() {
  if (!A) return;
  invalidateSlot(A);
  const C = safeCurrentCharacter();
  if (C && isSlotMasked(C, A) && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
}
