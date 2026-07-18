import {Tag} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {activeWardrobeSource, getSlotMeta} from '@/core/wardrobeStorage';
import {openDialog} from '@/core/dialogs';
import {Button} from '@/components/ui/Button';
import {TagDialog} from '@/components/wardrobe/dialogs/TagDialog';

export function TagRow({selection}: { selection: number }) {
  const hasSelection = selection >= 0;
  const tags = hasSelection ? getSlotMeta(activeWardrobeSource().id, selection).tags : [];

  return <div className="flex items-center justify-between gap-2">
    <span className="truncate text-[24px] text-white">{t('wardrobe-tag')}</span>
    <Button density="stage"
            className="h-10 w-42.5"
            disabled={!hasSelection}
            onClick={() => openDialog(close => <TagDialog slot={selection} onClose={close}/>)}
            icon={<Tag className="h-5 w-5"/>}
    >
      {!hasSelection
        ? t('wardrobe-select-slot-first')
        : tags.length ? tags.join(', ') : t('wardrobe-add-tag')}
    </Button>
  </div>;
}