import {Check, Folder, Globe, Image as ImageIcon, Palette} from 'lucide-react';
import type {ReactNode} from 'react';
import cn from '@/util/cn';
import {type BackgroundChoice, backgroundChoiceLabel,} from '@/components/wardrobe/dialogs/backgroundChoices';
import type {BackgroundChoiceType} from '@/core/types';

export function BackgroundChoiceIcon({type}: { type: BackgroundChoiceType }) {
  const className = 'h-7 w-7 text-white/50';
  if (type === 'color') return <Palette className={className}/>;
  if (type === 'url') return <Globe className={className}/>;
  if (type === 'custom') return <Folder className={className}/>;
  return <ImageIcon className={className}/>;
}

export function BackgroundCard({
                                 choice,
                                 selected,
                                 children,
                               }: {
  choice: BackgroundChoice;
  selected: boolean;
  children: ReactNode;
}) {
  return <div
    className={cn(
      'relative flex h-24 flex-col items-center justify-between overflow-hidden rounded-xl border bg-[rgba(24,24,34,0.7)] p-2.5 transition hover:bg-[rgba(40,40,56,0.7)]',
      selected ? 'border-2' : 'border-white/8 hover:border-white/20',
    )}
    style={selected ? {borderColor: 'var(--aee-accent)', boxShadow: '0 0 10px var(--aee-accent)'} : undefined}
  >
    {children}
    <span className="pointer-events-none w-full truncate text-center text-[20px] text-[#f0eee4]">
      {backgroundChoiceLabel(choice)}
    </span>
    {selected ? <span
      className="pointer-events-none absolute right-1 top-1 flex h-4.5 w-4.5 items-center justify-center rounded"
      style={{backgroundColor: 'var(--aee-accent)'}}
    >
      <Check className="h-3 w-3 text-black"/>
    </span> : null}
  </div>;
}
