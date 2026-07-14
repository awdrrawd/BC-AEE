import {Tag} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {getSlotMeta} from '@/core/wardrobeStorage';
import {setSlotTags} from '@/controllers/outfitsController';
import {askText} from '@/core/prompts';
import {Button} from '@/components/ui/Button';

export function TagRow({selection}: { selection: number }) {
  const hasSelection = selection >= 0;
  const tags = hasSelection ? getSlotMeta(selection).tags : [];

  const edit = async () => {
    const input = await askText(t('wardrobe-prompt-tags'), tags.join(', '));
    if (input == null) return;
    setSlotTags(selection, input.split(',').map(tag => tag.trim()).filter(Boolean));
  };

  return <div className="flex items-center justify-between gap-2">
    <span className="truncate text-[24px] text-white">{t('wardrobe-tag')}</span>
    <Button density="stage"
            className="h-10 w-42.5"
            disabled={!hasSelection}
            onClick={() => void edit()}
            icon={<Tag className="h-5 w-5"/>}
    >
      {!hasSelection
        ? t('wardrobe-select-slot-first')
        : tags.length ? tags.join(', ') : t('wardrobe-add-tag')}
    </Button>
  </div>;
}
