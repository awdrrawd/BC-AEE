import {useState} from 'react';
import {t} from '@/i18n/i18n';
import {knownTags} from '@/controllers/outfitsController';
import {saveWardrobeCategories} from '@/controllers/wardrobeController';
import {settings} from '@/core/settings';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {ListEditor} from '@/components/ui/ListEditor';

export function CategoryDialog({onClose}: { onClose: () => void }) {
  const [categories, setCategories] = useState(() => settings.wardrobeCategories.get());

  const confirm = () => {
    saveWardrobeCategories(categories);
    onClose();
  };

  return <Dialog onDismiss={onClose} className="w-180 gap-6 p-8">
    <h1 className="text-[26px] text-[#f0eee4]">{t('wardrobe-prompt-edit-categories')}</h1>

    <ListEditor
      density="stage"
      values={categories}
      suggestions={knownTags()}
      placeholder={t('wardrobe-category-placeholder')}
      onChange={setCategories}
      onCancel={onClose}
    />

    <div className="flex justify-end gap-3">
      <Button density="stage" className="h-12 w-35" onClick={onClose}>{t('wardrobe-cancel')}</Button>
      <Button density="stage" className="h-12 w-35" selected onClick={confirm}>{t('wardrobe-confirm')}</Button>
    </div>
  </Dialog>;
}