type DragState = {
  area: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  startScrollTop: number;
  dragging: boolean;
};

/** Adds mouse/pen drag scrolling to every AEE scroll area. Touch keeps its
 * native kinetic scrolling; clicks are cancelled only after a real drag. */
export function installDragScroll(root: HTMLElement): () => void {
  let drag: DragState | null = null;
  let suppressArea: HTMLElement | null = null;

  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const area = target?.closest<HTMLElement>('.aee-scroll');
    if (!area || area.scrollHeight <= area.clientHeight + 1) return;
    // Sliders need their horizontal gesture. All other rows and buttons may
    // be used as a scroll-grab surface; their click is suppressed after drag.
    if (target.closest('input[type="range"], textarea, select, [contenteditable="true"]')) return;
    drag = {
      area,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollTop: area.scrollTop,
      dragging: false,
    };
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(dx)) return;
      drag.dragging = true;
      drag.area.classList.add('aee-drag-scrolling');
      try { drag.area.setPointerCapture(event.pointerId); } catch { /* detached during a screen change */ }
    }
    event.preventDefault();
    drag.area.scrollTop = drag.startScrollTop - dy;
  };

  const finish = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const finished = drag;
    drag = null;
    finished.area.classList.remove('aee-drag-scrolling');
    if (!finished.dragging) return;
    suppressArea = finished.area;
    window.setTimeout(() => {
      if (suppressArea === finished.area) suppressArea = null;
    }, 0);
  };

  const suppressDraggedClick = (event: MouseEvent) => {
    if (!suppressArea || !(event.target instanceof Node) || !suppressArea.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressArea = null;
  };

  root.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('pointermove', onPointerMove, {capture: true, passive: false});
  root.addEventListener('pointerup', finish, true);
  root.addEventListener('pointercancel', finish, true);
  root.addEventListener('click', suppressDraggedClick, true);
  return () => {
    root.removeEventListener('pointerdown', onPointerDown, true);
    root.removeEventListener('pointermove', onPointerMove, true);
    root.removeEventListener('pointerup', finish, true);
    root.removeEventListener('pointercancel', finish, true);
    root.removeEventListener('click', suppressDraggedClick, true);
  };
}
