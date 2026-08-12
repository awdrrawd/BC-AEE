import {type PointerEvent, type WheelEvent, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {gridColumns, gridRows, isSlotOccupied, pageCount, perPage, slotName, swapOutfits} from '@/controllers/outfitsController';
import {goToPage, markOrSwap, selectSlot, startEditingOutfit} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {clamp} from '@/util/math';
import {slotFromPoint} from '@/util/slotDrag';
import {OutfitCard} from '@/components/wardrobe/OutfitCard';
import {useStage} from '@/components/wardrobe/stageContext';

const SLIDE_MS = 220;
// Fraction of the grid height a drag must pass to commit to the next/previous page.
const COMMIT_FRACTION = 0.15;
// Vertical travel (screen px) beyond which a press counts as a drag, not a card tap.
const DRAG_SLOP = 6;
// While dragging a card, dwelling within this many screen px of the top/bottom edge auto-pages.
const EDGE_BAND = 48;
const EDGE_INTERVAL = 450;

export function OutfitGrid({state, slots}: { state: WardrobeState; slots: number[] }) {
  const size = perPage();
  const pages = pageCount(slots);
  const current = Math.floor(state.offset / size);
  // Latest page/count for the auto-page interval, whose closure would otherwise capture stale values.
  const currentRef = useRef(current);
  currentRef.current = current;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  // The stage is rendered under a transform: scale(), so convert screen-pixel drag deltas into the
  // stage's own coordinates — otherwise the tracked movement is scaled down and feels unresponsive.
  const {scale} = useStage();

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  const start = useRef<{x: number; y: number} | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const dragY = useRef(0);
  // Direction to apply once the slide animation ends: -1 prev, +1 next, 0 snap-back.
  const pending = useRef<number | null>(null);

  // --- Card drag-to-reorder (only while reorder mode is on) ---
  // A floating ghost (not the card itself) follows the pointer, so it survives the page flips that
  // auto-paging triggers — the dragged card unmounts once its page scrolls away.
  const ghostRef = useRef<HTMLDivElement>(null);
  const dragEl = useRef<HTMLElement | null>(null); // source card, dimmed while dragging (may unmount on a page flip)
  const dragSlot = useRef(-1);
  const dragActive = useRef(false);
  const [dropTarget, setDropTarget] = useState(-1);
  // Auto-page while the pointer dwells near the top/bottom edge, to reach cards on other pages.
  const edgeTimer = useRef<number | null>(null);
  const edgeDir = useRef(0);

  // Which neighbour page is also mounted right now: -1 prev, +1 next, 0 none. Kept minimal so mobile
  // never holds more than two pages of (canvas-heavy) previews at once — three resident pages plus
  // rapid paging blows past mobile canvas-memory limits and reloads the tab.
  const [neighbor, setNeighbor] = useState(0);
  const neighborRef = useRef(0);
  const setNeighborDir = (dir: number) => {
    if (neighborRef.current === dir) return;
    neighborRef.current = dir;
    setNeighbor(dir);
  };

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stop the auto-page interval if the grid unmounts mid-drag.
  useEffect(() => () => {
    if (edgeTimer.current != null) clearInterval(edgeTimer.current);
  }, []);

  // React registers touch listeners as passive, so preventDefault from the pointer handlers is
  // ignored and the browser still runs pull-to-refresh / overscroll-back on a vertical swipe.
  // A native, non-passive touchmove listener cancels that gesture — the grid never scrolls itself.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (event: TouchEvent) => event.preventDefault();
    el.addEventListener('touchmove', block, {passive: false});
    return () => el.removeEventListener('touchmove', block);
  }, []);

  // Imperatively drive the track so dragging never re-renders (and redraws) the card canvases.
  // Base position is the current page centred; `offsetY` slides the neighbours in vertically.
  const paint = (offsetY: number, animate: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : 'none';
    el.style.transform = `translateY(${-current * height + offsetY}px)`;
  };

  // Re-anchor whenever the page or height changes (page commits land here after the slide).
  useLayoutEffect(() => {
    if (dragging.current) return;
    dragY.current = 0;
    paint(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, height]);

  const onWheel = (event: WheelEvent) => goToPage(current + (event.deltaY > 0 ? 1 : -1), pages);

  const clearEdge = () => {
    if (edgeTimer.current != null) clearInterval(edgeTimer.current);
    edgeTimer.current = null;
    edgeDir.current = 0;
  };

  const resetDrag = () => {
    if (dragEl.current) dragEl.current.style.opacity = '';
    if (ghostRef.current) ghostRef.current.style.display = 'none';
    dragEl.current = null;
    dragSlot.current = -1;
    dragActive.current = false;
    clearEdge();
    setDropTarget(-1);
  };

  // Ghost follows the pointer in the container's own (unscaled) coordinates.
  const moveGhost = (x: number, y: number) => {
    const ghost = ghostRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!ghost || !rect) return;
    ghost.style.transform = `translate(${(x - rect.left) / (scale || 1) + 14}px, ${(y - rect.top) / (scale || 1) + 14}px)`;
  };

  const onReorderDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const card = (event.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
    const slot = card ? Number(card.getAttribute('data-slot')) : -1;
    // Only an occupied slot can be picked up; an empty-slot press falls through to a tap (markOrSwap).
    if (slot < 0 || !isSlotOccupied(slot)) return;
    start.current = {x: event.clientX, y: event.clientY};
    dragEl.current = card;
    dragSlot.current = slot;
    dragActive.current = false;
    moved.current = false;
  };

  const onReorderMove = (event: PointerEvent) => {
    const from = start.current;
    if (!from) return;
    if (!dragActive.current) {
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) < DRAG_SLOP) return;
      dragActive.current = true;
      moved.current = true; // suppress the follow-up click so it doesn't also trigger markOrSwap
      containerRef.current?.setPointerCapture(event.pointerId);
      if (dragEl.current) dragEl.current.style.opacity = '0.35';
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.textContent = `#${dragSlot.current + 1} ${slotName(dragSlot.current)}`.trim();
        ghost.style.display = 'block';
      }
    }
    moveGhost(event.clientX, event.clientY);
    const target = slotFromPoint(containerRef.current?.getRootNode() as Document | ShadowRoot, event.clientX, event.clientY);
    setDropTarget(target !== dragSlot.current ? target : -1);

    // Dwell near an edge → page that direction, repeating so several pages can be crossed.
    const rect = containerRef.current?.getBoundingClientRect();
    const dir = !rect ? 0
      : event.clientY < rect.top + EDGE_BAND ? -1
        : event.clientY > rect.bottom - EDGE_BAND ? 1 : 0;
    if (dir !== edgeDir.current) {
      clearEdge();
      if (dir !== 0) {
        edgeDir.current = dir;
        edgeTimer.current = window.setInterval(() => goToPage(currentRef.current + dir, pagesRef.current), EDGE_INTERVAL);
      }
    }
  };

  const onReorderUp = (event: PointerEvent) => {
    if (!start.current) return;
    const source = dragSlot.current;
    const target = dragActive.current
      ? slotFromPoint(containerRef.current?.getRootNode() as Document | ShadowRoot, event.clientX, event.clientY)
      : -1;
    start.current = null;
    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
    resetDrag();
    if (target >= 0 && target !== source) swapOutfits(source, target);
  };

  const onReorderCancel = (event: PointerEvent) => {
    start.current = null;
    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
    resetDrag();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (state.reorderMode) return onReorderDown(event);
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start.current = {x: event.clientX, y: event.clientY};
    dragging.current = true;
    moved.current = false;
    dragY.current = 0;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (state.reorderMode) return onReorderMove(event);
    const from = start.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!moved.current) {
      if (Math.abs(dy) < DRAG_SLOP || Math.abs(dy) <= Math.abs(dx)) return;
      moved.current = true;
      // Capture only once it's a real drag — capturing on pointerdown would retarget the
      // follow-up click to this container and stop a plain tap from selecting a card.
      containerRef.current?.setPointerCapture(event.pointerId);
    }
    // Convert the screen-space delta into stage units so the grid tracks the finger 1:1.
    const travel = dy / (scale || 1);
    const max = current > 0 ? height : 0;
    const min = current < pages - 1 ? -height : 0;
    dragY.current = clamp(travel, min, max);
    // Mount only the neighbour actually being revealed (drag down → prev above, up → next below).
    if (dragY.current > 0) setNeighborDir(-1);
    else if (dragY.current < 0) setNeighborDir(1);
    paint(dragY.current, false);
  };

  const endDrag = (event: PointerEvent) => {
    if (state.reorderMode) return onReorderUp(event);
    if (!start.current) return;
    start.current = null;
    dragging.current = false;
    const d = dragY.current;
    const threshold = height * COMMIT_FRACTION;
    if (d >= threshold && current > 0) {
      pending.current = -1;
      paint(height, true);
    } else if (d <= -threshold && current < pages - 1) {
      pending.current = 1;
      paint(-height, true);
    } else {
      pending.current = 0;
      paint(0, true);
    }
    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const onTransitionEnd = () => {
    const direction = pending.current;
    pending.current = null;
    // Drop the neighbour first (same batch as the commit) so the landed page is the only one left
    // mounted — the committed page was already the neighbour, so it persists without a rebuild.
    neighborRef.current = 0;
    setNeighbor(0);
    if (direction === 1 || direction === -1) {
      // The end-of-slide transform already equals the new page's anchor, so the commit is seamless.
      goToPage(current + direction, pages);
    }
  };

  const gridStyle = {
    gridTemplateColumns: `repeat(${gridColumns()}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridRows()}, minmax(0, 1fr))`,
  };

  const renderPage = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= pages) return null;
    const cards = slots.slice(pageIndex * size, pageIndex * size + size);
    return <div
      key={pageIndex}
      className="absolute inset-x-0 grid gap-2.5"
      style={{top: pageIndex * height, height, ...gridStyle}}
    >
      {cards.map(slotIndex => <OutfitCard
        key={slotIndex}
        slotIndex={slotIndex}
        selected={slotIndex === state.selection}
        markedForSwap={state.reorderMode && slotIndex === state.reorderFirst}
        dropTarget={state.reorderMode && slotIndex === dropTarget}
        onSelect={() => (state.reorderMode ? markOrSwap(slotIndex) : selectSlot(slotIndex))}
        onRename={state.reorderMode ? undefined : () => startEditingOutfit(slotIndex)}
      />)}
    </div>;
  };

  return <div
    ref={containerRef}
    className="relative min-h-0 flex-1 overflow-hidden"
    style={{touchAction: 'none', overscrollBehavior: 'contain', cursor: state.reorderMode ? 'grab' : undefined}}
    onWheel={onWheel}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={endDrag}
    onPointerCancel={state.reorderMode ? onReorderCancel : endDrag}
    onClickCapture={event => {
      if (!moved.current) return;
      moved.current = false;
      event.preventDefault();
      event.stopPropagation();
    }}
  >
    <div ref={trackRef} className="absolute inset-0" onTransitionEnd={onTransitionEnd}>
      {(neighbor === -1 ? [current - 1, current]
        : neighbor === 1 ? [current, current + 1]
          : [current]).map(renderPage)}
    </div>

    <div
      ref={ghostRef}
      className="pointer-events-none absolute left-0 top-0 z-40 hidden max-w-60 truncate rounded-lg border-2 border-dashed border-(--aee-accent) bg-black/80 px-3 py-1.5 text-[20px] text-(--aee-text-strong) shadow-lg"
    />
  </div>;
}
