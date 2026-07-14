import {useState} from 'react';
import {t} from '@/i18n/i18n';
import {knownTags, setSlotTags} from '@/controllers/outfitsController';
import {getSlotMeta} from '@/core/wardrobeStorage';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {ListEditor} from '@/components/ui/ListEditor';

export function TagDialog({slot, onClose}: { slot: number; onClose: () => void }) {
  const [tags, setTags] = useState(() => getSlotMeta(slot).tags);

  const confirm = () => {
    setSlotTags(slot, tags);
    onClose();
  };

  return <Dialog onDismiss={onClose} className="w-180 gap-6 p-8">
    <h1 className="text-[26px] text-[#f0eee4]">{t('wardrobe-prompt-tags')}</h1>

    <ListEditor
      density="stage"
      values={tags}
      suggestions={knownTags()}
      placeholder={t('wardrobe-tag-placeholder')}
      onChange={setTags}
      onCancel={onClose}
    />

    <div className="flex justify-end gap-3">
      <Button density="stage" className="h-12 w-35" onClick={onClose}>{t('wardrobe-cancel')}</Button>
      <Button density="stage" className="h-12 w-35" selected onClick={confirm}>{t('wardrobe-confirm')}</Button>
    </div>
  </Dialog>;
}