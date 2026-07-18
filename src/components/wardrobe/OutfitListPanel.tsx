import {Trash2} from 'lucide-react';
import {useMemo} from 'react';
import {t} from '@/i18n/i18n';

import {deleteOutfit, filterSlots, getOccupiedSlots, isSlotOccupied, slotTagIcons} from '@/controllers/outfitsController';
import {jumpToSlot, setWardrobeSource, startEditingOutfit} from '@/controllers/wardrobeController';
import {askConfirm} from '@/core/prompts';
import type {WardrobeState} from '@/core/wardrobeStore';
import {SearchField} from '@/components/wardrobe/SearchField';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';

export function OutfitListPanel({state}: { state: WardrobeState }) {
  const slots = useMemo(
    () => getOccupiedSlots(state.sortMode),
    // dataVersion re-reads the occupied slots after any wardrobe change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.dataVersion, state.sortMode],
  );
  const canDelete = state.selection >= 0 && isSlotOccupied(state.selection);

  const remove = async () => {
    if (await askConfirm(t('wardrobe-confirm-delete'), true)) deleteOutfit(state.selection);
  };

  return <Panel soft className="aee-rise-in w-80 shrink-0 gap-2.5 p-2.5">
    <SearchField value={state.search}/>

    <div className="aee-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl bg-black/20 p-1.5">
      {slots.length === 0
        ? <p className="mt-4 text-center text-[22px] text-zinc-500">{t('wardrobe-no-saved-outfits')}</p>
        : slots.map(slot => {
          const icons = slotTagIcons(slot.index);
          return <Button density="stage"
                         key={slot.index}
                         selected={state.selection === slot.index}
                         onClick={() => jumpToSlot(slot.index, filterSlots('', null, state.sortMode).indexOf(slot.index))}
                         onDoubleClick={() => startEditingOutfit(slot.index)}
                         className="h-8.5 shrink-0 justify-start text-left"
          >
            <span className="inline-block shrink-0 text-right tabular-nums text-white/50" style={{minWidth: '3ch'}}>
              {slot.index + 1}
            </span>
            <span className="ml-2 truncate">{slot.name}</span>
            {icons.length ? <span className="ml-auto shrink-0 pl-1">{icons.join('')}</span> : null}
          </Button>;
        })}
    </div>

    <Button density="stage"
            className="h-9.5 shrink-0"
            disabled={!canDelete}
            onClick={() => void remove()}
            icon={<Trash2 className="h-5 w-5"/>}
    >{t('wardrobe-delete-outfit')}</Button>

    <div className="flex h-12.5 shrink-0 gap-2.5">
      <Button density="stage"
              className="flex-1"
              selected={state.source === 'online'}
              onClick={() => setWardrobeSource('online')}
      >{t('wardrobe-online')}</Button>
      <Button density="stage"
              className="flex-1"
              selected={state.source === 'local'}
              onClick={() => setWardrobeSource('local')}
      >{t('wardrobe-local')}</Button>
    </div>
  </Panel>;
}
