import {Trash2} from 'lucide-react';
import {useMemo} from 'react';
import {t} from '@/i18n/i18n';

import {deleteOutfit, filterSlots, getOccupiedSlots, isSlotOccupied} from '@/controllers/outfitsController';
import {jumpToSlot} from '@/controllers/wardrobeController';
import {askConfirm} from '@/core/prompts';
import type {WardrobeState} from '@/core/wardrobeStore';
import {SearchField} from '@/components/wardrobe/SearchField';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';
import {settings, useSetting} from '@/core/settings';

export function OutfitListPanel({state}: { state: WardrobeState }) {
  const slots = useMemo(getOccupiedSlots, [state.dataVersion]);
  const canDelete = state.selection >= 0 && isSlotOccupied(state.selection);
  const onlineOnly = !useSetting(settings.wardrobeCacheOnline);

  const remove = async () => {
    if (await askConfirm(t('wardrobe-confirm-delete'), true)) deleteOutfit(state.selection);
  };

  return <Panel className="aee-rise-in w-80 shrink-0 gap-2.5 p-2.5">
    <SearchField value={state.search}/>

    <div className="aee-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl bg-black/20 p-1.5">
      {slots.length === 0
        ? <p className="mt-4 text-center text-[22px] text-zinc-500">{t('wardrobe-no-saved-outfits')}</p>
        : slots.map(slot => <Button density="stage"
                                    key={slot.index}
                                    selected={state.selection === slot.index}
                                    onClick={() => jumpToSlot(slot.index, filterSlots('', null, state.sortMode).indexOf(slot.index))}
                                    className="h-8.5 shrink-0 justify-start text-left"
        >
          <span className="tabular-nums text-white/50">#{slot.index + 1}</span>
          <span className="ml-2 truncate">{slot.name}</span>
        </Button>)}
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
              selected={onlineOnly}
              onClick={() => settings.wardrobeCacheOnline.set(false)}
      >{t('wardrobe-online')}</Button>
      <Button density="stage"
              className="flex-1"
              selected={!onlineOnly}
              onClick={() => settings.wardrobeCacheOnline.set(true)}
      >{t('wardrobe-local')}</Button>
    </div>
  </Panel>;
}
