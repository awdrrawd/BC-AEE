import {getWardrobeState, setWardrobeState} from './wardrobeStore';
import {activeWardrobeSource, storageScope, type WardrobeSource} from './wardrobeStorage';

/** Serialize user mutations before their optimistic writes, not just network requests. */
export async function wardrobeMutation<T>(fallback: T, work: () => Promise<T>, source: WardrobeSource = activeWardrobeSource()): Promise<T> {
  if (getWardrobeState().saving || source.isReady?.() === false) return fallback;
  setWardrobeState({saving: true});
  try { return await work(); }
  finally { setWardrobeState({saving: false}); }
}

export function wardrobeIdentity() {
  const player = Player;
  const member = Player?.MemberNumber;
  const scope = storageScope();
  return () => Player === player && Player?.MemberNumber === member && storageScope() === scope;
}
