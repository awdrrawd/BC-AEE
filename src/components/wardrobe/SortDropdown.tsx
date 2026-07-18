import {Check, ChevronDown} from 'lucide-react';
import {useState} from 'react';
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

  const pick = (mode: WardrobeSortMode) => {
    setSortMode(mode);
    setOpen(false);
  };

  return <div className="relative h-full w-45 shrink-0">
    <Button density="stage"
            className="h-full w-full justify-between"
            selected={open}
            onClick={() => setOpen(value => !value)}
    >
      <span className="truncate">{t(SORT_LABEL_KEYS[sortMode])}</span>
      <ChevronDown className="h-4 w-4 shrink-0" style={{color: open ? 'var(--aee-accent)' : undefined}}/>
    </Button>

    {open ? <>
      {/* Full-stage transparent catcher so any outside click closes the menu reliably. */}
      <div className="fixed inset-0 z-[1000000]" aria-hidden="true" onClick={() => setOpen(false)}/>
      <div
        className="aee-pop-in absolute right-0 top-full z-[1000001] mt-0.5 flex w-52.5 flex-col gap-0.5 rounded-xl bg-[rgba(10,10,14,0.97)] p-1"
        style={{border: 'var(--aee-panel-border)'}}
      >
        {SORT_MODES.map(mode => <Button density="stage"
                                        key={mode}
                                        className="h-10 justify-between"
                                        selected={mode === sortMode}
                                        onClick={() => pick(mode)}
        >
          <span className="truncate">{t(SORT_LABEL_KEYS[mode])}</span>
          {mode === sortMode ? <Check className="h-4 w-4 shrink-0"/> : null}
        </Button>)}
      </div>
    </> : null}
  </div>;
}
