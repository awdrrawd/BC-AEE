/** The wardrobe slot index under a screen point, hit-tested through the shadow root. Returns -1 if none. */
export function slotFromPoint(root: Document | ShadowRoot | null | undefined, x: number, y: number): number {
  const slot = root?.elementFromPoint(x, y)?.closest('[data-slot]')?.getAttribute('data-slot');
  return slot == null ? -1 : Number(slot);
}
