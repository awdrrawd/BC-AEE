import type {WheelEvent} from 'react';
import {gridColumns, GRID_ROWS, pageCount, perPage} from '@/controllers/outfitsController';
import {goToPage, markOrSwap, selectSlot, startEditingOutfit} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {OutfitCard} from '@/components/wardrobe/OutfitCard';

export function OutfitGrid({state, slots}: { state: WardrobeState; slots: number[] }) {
  const size = perPage();
  const page = slots.slice(state.offset, state.offset + size);

  const onWheel = (event: WheelEvent) => {
    const current = Math.floor(state.offset / size);
    goToPage(current + (event.deltaY > 0 ? 1 : -1), pageCount(slots));
  };

  return <div
    className="aee-grid-stretch grid min-h-0 flex-1 gap-2.5"
    onWheel={onWheel}
    style={{
      gridTemplateColumns: `repeat(${gridColumns()}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
    }}
  >
    {page.map(slotIndex => <OutfitCard
      key={slotIndex}
      slotIndex={slotIndex}
      selected={slotIndex === state.selection}
      markedForSwap={state.reorderMode && slotIndex === state.reorderFirst}
      onSelect={() => (state.reorderMode ? markOrSwap(slotIndex) : selectSlot(slotIndex))}
      onRename={state.reorderMode ? undefined : () => startEditingOutfit(slotIndex)}
    />)}
  </div>;
}
