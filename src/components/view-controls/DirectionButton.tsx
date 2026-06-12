import {type ChevronDirection, ChevronIcon} from '@/components/icons/ChevronIcon';

export function DirectionButton({direction, onClick}: { direction: ChevronDirection; onClick: () => void }) {
  return <button
    className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-violet-300"
    onClick={onClick}>
    <ChevronIcon direction={direction} size={12}/>
  </button>;
}
