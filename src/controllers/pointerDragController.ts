export function beginPointerDrag(event: PointerEvent, onMove: (event: PointerEvent) => void, onEnd?: () => void) {
  const target = event.currentTarget instanceof Element ? event.currentTarget : null;
  const pointerId = event.pointerId;
  let active = true;
  const finish = () => {
    if (!active) return;
    active = false;
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', finishEvent, true);
    document.removeEventListener('pointercancel', finishEvent, true);
    window.removeEventListener('blur', finish);
    if (target instanceof Element && 'releasePointerCapture' in target) {
      try { (target as Element & {releasePointerCapture(id: number): void}).releasePointerCapture(pointerId); } catch { /* capture may already be released */ }
    }
    onEnd?.();
  };
  const move = (next: PointerEvent) => {
    if (next.pointerId === pointerId) onMove(next);
  };
  const finishEvent = (next: PointerEvent) => {
    if (next.pointerId === pointerId) finish();
  };
  if (target && 'setPointerCapture' in target) {
    try { (target as Element & {setPointerCapture(id: number): void}).setPointerCapture(pointerId); } catch { /* document listeners remain the fallback */ }
  }
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', finishEvent, true);
  document.addEventListener('pointercancel', finishEvent, true);
  window.addEventListener('blur', finish);
  return finish;
}
