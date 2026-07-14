import {ChevronDown} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {t} from '@/i18n/i18n';
import {setSortMode} from '@/controllers/wardrobeController';
import {Button} from '@/components/ui/Button';
import type {WardrobeSortMode} from '@/core/types';

const SORT_MODES: WardrobeSortMode[] = ['default', 'name', 'favorite', 'occupied'];

const SORT_LABEL_KEYS: Record<WardrobeSortMode, string> = {
  default: 'wardrobe-sort-slot',
  name: 'wardrobe-sort-name',
  favorite: 'wardrobe-sort-favorite',
  occupied: 'wardrobe-sort-occupied',
};

export function SortDropdown({sortMode}: { sortMode: WardrobeSortMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [open]);

  return <div ref={ref} className="relative h-full w-45 shrink-0">
    <Button density="stage"
            className="h-full w-full justify-between"
            selected={open}
            onClick={() => setOpen(value => !value)}
    >
      <span className="truncate">{t(SORT_LABEL_KEYS[sortMode])}</span>
      <ChevronDown className="h-4 w-4 shrink-0" style={{color: open ? 'var(--aee-accent)' : undefined}}/>
    </Button>

    {open ? <div
      className="aee-pop-in absolute right-0 top-full z-10 mt-0.5 flex w-52.5 flex-col gap-0.5 rounded-xl bg-[rgba(10,10,14,0.97)] p-1"
      style={{border: 'var(--aee-panel-border)'}}
    >
      {SORT_MODES.map(mode => <Button density="stage"
                                      key={mode}
                                      className="h-10 justify-start"
                                      selected={mode === sortMode}
                                      onClick={() => {
                                        setSortMode(mode);
                                        setOpen(false);
                                      }}
      >{t(SORT_LABEL_KEYS[mode])}</Button>)}
    </div> : null}
  </div>;
}
