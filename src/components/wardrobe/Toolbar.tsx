import {ArrowRightLeft, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {setWardrobeSource, toggleReorderMode} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {FilterBar} from '@/components/wardrobe/FilterBar';
import {SortDropdown} from '@/components/wardrobe/SortDropdown';
import {Button} from '@/components/ui/Button';

export function Toolbar({state, layout}: { state: WardrobeState; layout: string[] }) {
  // When the outfit-list panel (A) is hidden, its local/online switch moves here.
  const showSourceToggle = !layout.includes('list');

  return <div
    className="aee-rise-in flex h-11 shrink-0 items-center gap-2.5"
    style={{animationDelay: '60ms'}}
  >
    {showSourceToggle ? <Button density="stage"
            className="h-full w-36 shrink-0"
            onClick={() => setWardrobeSource(state.source === 'local' ? 'online' : 'local')}
    >{state.source === 'local' ? t('wardrobe-local') : t('wardrobe-online')}</Button> : null}

    <FilterBar activeFilter={state.activeFilter}/>
    <SortDropdown sortMode={state.sortMode}/>

    <Button density="stage"
            className="h-full w-11"
            selected={state.reorderMode}
            onClick={toggleReorderMode}
            icon={state.reorderMode ? <X className="h-5 w-5"/> :
              <ArrowRightLeft className="h-5 w-5"/>}
            aria-label="swap outfits"
    />
  </div>;
}
