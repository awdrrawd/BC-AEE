import type {SavedColor} from './types';
import {hsvaString} from './colorMath';

export function SavedCell({item, selected, onClick}: {item: SavedColor; selected: boolean; onClick: () => void}) {
  return <button className={`relative aspect-square rounded border bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:8px_8px] ${selected ? 'border-violet-400' : 'border-zinc-700 hover:border-zinc-500'}`} onClick={onClick}>
    <span className="absolute inset-0 rounded-[3px]" style={{background: hsvaString(item.h, item.s, item.v, item.a)}}/>
  </button>;
}
