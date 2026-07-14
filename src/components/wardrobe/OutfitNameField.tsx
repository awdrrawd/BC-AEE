import {t} from '@/i18n/i18n';
import {setName} from '@/controllers/wardrobeController';
import {TextInput} from '@/components/ui/Fields';

export function OutfitNameField({value, disabled}: { value: string; disabled: boolean }) {
  return <TextInput
    density="stage"
    type="text"
    value={value}
    maxLength={20}
    disabled={disabled}
    placeholder={disabled ? t('wardrobe-no-slot-selected') : t('wardrobe-name-placeholder')}
    onChange={event => setName(event.currentTarget.value)}
    className="h-11 shrink-0 text-[22px] disabled:opacity-50"
  />;
}
