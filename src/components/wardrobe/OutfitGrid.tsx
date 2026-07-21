import {type PointerEvent, type WheelEvent, useLayoutEffect, useRef, useState} from 'react';
import {gridColumns, gridRows, pageCount, perPage} from '@/controllers/outfitsController';
import {goToPage, markOrSwap, selectSlot, startEditingOutfit} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {clamp} from '@/util/math';
import {OutfitCard} from '@/components/wardrobe/OutfitCard';
import {useStage} from '@/components/wardrobe/stageContext';

const SLIDE_MS = 220;
// Fraction of the grid height a drag must pass to commit to the next/previous page.
const COMMIT_FRACTION = 0.15;
// Vertical travel (screen px) beyond which a press counts as a drag, not a card tap.
const DRAG_SLOP = 6;

export function OutfitGrid({state, slots}: { state: WardrobeState; slots: number[] }) {
  const size = perPage();
  const pages = pageCount(slots);
  const current = Math.floor(state.offset / size);
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

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
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

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start.current = {x: event.clientX, y: event.clientY};
    dragging.current = true;
    moved.current = false;
    dragY.current = 0;
  };

  const onPointerMove = (event: PointerEvent) => {
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
    paint(dragY.current, false);
  };

  const endDrag = (event: PointerEvent) => {
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
        onSelect={() => (state.reorderMode ? markOrSwap(slotIndex) : selectSlot(slotIndex))}
        onRename={state.reorderMode ? undefined : () => startEditingOutfit(slotIndex)}
      />)}
    </div>;
  };

  return <div
    ref={containerRef}
    className="relative min-h-0 flex-1 overflow-hidden"
    style={{touchAction: 'none'}}
    onWheel={onWheel}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={endDrag}
    onPointerCancel={endDrag}
    onClickCapture={event => {
      if (!moved.current) return;
      moved.current = false;
      event.preventDefault();
      event.stopPropagation();
    }}
  >
    <div ref={trackRef} className="absolute inset-0" onTransitionEnd={onTransitionEnd}>
      {[current - 1, current, current + 1].map(renderPage)}
    </div>
  </div>;
}
