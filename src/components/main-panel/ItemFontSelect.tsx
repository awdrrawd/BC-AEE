import {t} from '@/i18n/i18n';
import {Select} from '@/components/ui/Fields';
import {useSetting, settings} from '@/core/settings';
import {CUSTOM_FONTS, DEFAULT_FONT_ID, formatFontSize, SYSTEM_FONTS} from '@/core/fonts';
import {selectItemFont} from '@/controllers/fontController';

export function ItemFontSelect() {
  const value = useSetting(settings.itemFont) || DEFAULT_FONT_ID;
  return <div className="flex items-center justify-between gap-2 border-b border-zinc-800 py-2"
              title={t('settings-item-font-label')}>
    <span className="text-xs text-zinc-300">{t('settings-item-font-label')}</span>
    <Select value={value} onChange={event => selectItemFont(event.target.value)}>
      <option value={DEFAULT_FONT_ID}>{t('settings-item-font-default')}</option>
      <optgroup label={t('settings-item-font-system-group')}>
        {SYSTEM_FONTS.map(font => <option key={font.id} value={font.id}>{font.name}</option>)}
      </optgroup>
      {CUSTOM_FONTS.length > 0 && <optgroup label={t('settings-item-font-custom-group')}>
        {CUSTOM_FONTS.map(font => <option key={font.id} value={font.id}>
          {font.size ? `${font.name} (${formatFontSize(font.size)})` : font.name}
        </option>)}
      </optgroup>}
    </Select>
  </div>;
}
