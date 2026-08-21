import type {SavedColor} from '@/components/color-picker/types';
import {hsvaString} from '@/components/color-picker/colorMath';

export function SavedCell({item, selected = false, onClick}: { item: SavedColor | null; selected?: boolean; onClick: () => void }) {
  return <button
    className={`relative h-14 w-14 shrink-0 rounded border bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:8px_8px] ${selected ? 'border-[var(--aee-accent)]' : 'border-zinc-700 hover:border-zinc-500'}`}
    disabled={!item}
    onClick={onClick}>
    {item ? <span className="absolute inset-0 rounded-[3px]" style={{background: hsvaString(item.h, item.s, item.v, item.a)}}/> : null}
  </button>;
}
