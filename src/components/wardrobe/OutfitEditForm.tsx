import {useState} from 'react';
import {Check, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {knownTags, saveOutfitMeta, slotName} from '@/controllers/outfitsController';
import {stopEditingOutfit} from '@/controllers/wardrobeController';
import {activeWardrobeSource, getSlotMeta} from '@/core/wardrobeStorage';
import {Button} from '@/components/ui/Button';
import {TextInput} from '@/components/ui/Fields';
import {ListEditor} from '@/components/ui/ListEditor';

/** Metadata editor shown in the manage panel after a double-click — renames and retags only. */
export function OutfitEditForm({slot}: { slot: number }) {
  const [name, setName] = useState(() => slotName(slot));
  const [tags, setTags] = useState(() => getSlotMeta(activeWardrobeSource().id, slot).tags);

  const save = () => {
    saveOutfitMeta(slot, name, tags);
    stopEditingOutfit();
  };

  return <>
    <h2 className="shrink-0 text-center text-[28px] text-[#f0eee4]">{t('wardrobe-outfit-edit')}</h2>

    <label className="text-[22px] text-white/70">{t('wardrobe-edit-name')}</label>
    <TextInput
      density="stage"
      type="text"
      value={name}
      maxLength={20}
      autoFocus
      placeholder={t('wardrobe-name-placeholder')}
      onChange={event => setName(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') save();
      }}
      className="h-11 shrink-0 text-[22px]"
    />

    <label className="mt-2 text-[22px] text-white/70">{t('wardrobe-tag')}</label>
    <ListEditor
      density="stage"
      autoFocus={false}
      values={tags}
      suggestions={knownTags()}
      placeholder={t('wardrobe-tag-placeholder')}
      onChange={setTags}
      onCancel={stopEditingOutfit}
    />

    <div className="mt-auto flex shrink-0 gap-2.5">
      <Button density="stage" className="h-12 flex-1" onClick={stopEditingOutfit}
              icon={<X className="h-5 w-5"/>}>{t('wardrobe-cancel')}</Button>
      <Button density="stage" className="h-12 flex-1" selected onClick={save}
              icon={<Check className="h-5 w-5"/>}>{t('wardrobe-save')}</Button>
    </div>
  </>;
}
