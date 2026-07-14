import type {WheelEvent} from 'react';
import {GRID_COLS, GRID_ROWS, pageCount, PER_PAGE} from '@/controllers/outfitsController';
import {goToPage, markOrSwap, selectSlot} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {OutfitCard} from '@/components/wardrobe/OutfitCard';

export function OutfitGrid({state, slots}: { state: WardrobeState; slots: number[] }) {
  const page = slots.slice(state.offset, state.offset + PER_PAGE);

  const onWheel = (event: WheelEvent) => {
    const current = Math.floor(state.offset / PER_PAGE);
    goToPage(current + (event.deltaY > 0 ? 1 : -1), pageCount(slots));
  };

  return <div
    className="aee-rise-in grid min-h-0 flex-1 gap-2.5"
    onWheel={onWheel}
    style={{
      animationDelay: '60ms',
      gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
    }}
  >
    {page.map(slotIndex => <OutfitCard
      key={slotIndex}
      slotIndex={slotIndex}
      selected={slotIndex === state.selection}
      markedForSwap={state.reorderMode && slotIndex === state.reorderFirst}
      onSelect={() => (state.reorderMode ? markOrSwap(slotIndex) : selectSlot(slotIndex))}
    />)}
  </div>;
}
