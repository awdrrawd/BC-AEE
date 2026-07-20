import {useSyncExternalStore} from 'react';

// Tiny store for whether the item-font picker popup is open. It renders at App level (not inside
// MainPanel's transformed container) so its positioning is viewport-relative and it still inherits
// the shadow-root styles and --aee-* theme variables. Position is derived from the canvas rect.
let open = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function openFontPanel() {
  if (open) return;
  open = true;
  emit();
}

export function closeFontPanel() {
  if (!open) return;
  open = false;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFontPanelOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}
