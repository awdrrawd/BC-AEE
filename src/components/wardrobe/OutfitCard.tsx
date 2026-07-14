import {Star} from 'lucide-react';
import cn from '@/util/cn';
import {getSlotMeta} from '@/core/wardrobeStorage';
import {isSlotOccupied, slotName, toggleFavorite} from '@/controllers/outfitsController';
import {CharacterPreview} from '@/components/wardrobe/CharacterPreview';

export function OutfitCard({
                             slotIndex,
                             selected,
                             markedForSwap,
                             onSelect,
                           }: {
  slotIndex: number;
  selected: boolean;
  markedForSwap: boolean;
  onSelect: () => void;
}) {
  const meta = getSlotMeta(slotIndex);
  const name = slotName(slotIndex);

  return <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') onSelect();
    }}
    className={cn(
      'group relative cursor-pointer overflow-hidden rounded-xl border transition',
      isSlotOccupied(slotIndex) ? 'bg-[rgba(16,16,24,0.55)]' : 'bg-white/3',
      !selected && !markedForSwap && 'border-white/6 hover:border-white/15 hover:bg-white/4',
    )}
    style={selected
      ? {borderColor: 'var(--aee-accent)', borderWidth: 3, boxShadow: '0 0 14px var(--aee-accent)'}
      : markedForSwap
        ? {borderColor: 'orange', borderWidth: 3}
        : undefined}
  >
    <CharacterPreview
      appearance={Player.Wardrobe?.[slotIndex]}
      className="pointer-events-none h-full w-full"
    />

    <button
      type="button"
      aria-label="favorite"
      aria-pressed={meta.favorite}
      onClick={event => {
        event.stopPropagation();
        toggleFavorite(slotIndex);
      }}
      className="absolute right-1.5 top-1.5 h-8.5 w-8.5 transition hover:scale-110"
      style={{color: meta.favorite ? 'var(--aee-accent)' : 'rgba(255,255,255,0.35)'}}
    >
      <Star fill={meta.favorite ? 'currentColor' : 'none'} className="h-full w-full"/>
    </button>

    {name ? <div
      className="absolute inset-x-1.5 bottom-1.5 truncate rounded-md bg-[rgba(10,10,14,0.75)] px-2 py-0.5 text-center text-[22px] text-zinc-200"
    >{name}</div> : null}
  </div>;
}
