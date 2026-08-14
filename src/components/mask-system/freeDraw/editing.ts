// Tiny shared "an edit just happened" hook. Split out on its own because it
// sits between slots.ts (invalidateSlot) and maskToggle.ts (isSlotMasked),
// both of which several other modules need independently of this.

import {A, invalidateSlot} from './slots';
import {safeCurrentCharacter} from './currentCharacter';
import {State} from './editorState';
import {isSlotMasked, syncVisCompanion} from './maskToggle';

export function afterEdit() {
  if (!A) return;
  State.priorityPreview = false;
  invalidateSlot(A);
  const C = safeCurrentCharacter();
  if (!C) return;
  // A brand-new drawing has no saved CustomDraw yet. Wear its Vis companion
  // locally as soon as content is edited so the priority slider has a real BC
  // appearance layer to reorder before the user saves.
  if (!isSlotMasked(C, A)) syncVisCompanion(C, A, true);
  if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
}
