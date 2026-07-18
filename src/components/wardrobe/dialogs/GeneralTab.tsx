import {getUiLanguageSetting, setUiLanguage, SUPPORTED_LANGUAGES, t} from '@/i18n/i18n';
import {type BooleanSetting, settings} from '@/core/settings';
import {SettingRow} from '@/components/ui/SettingRow';
import {Select} from '@/components/ui/Fields';

const TOGGLE_ROWS: Array<{ labelKey: string; setting: BooleanSetting }> = [
  {labelKey: 'wardrobe-setting-96-slots', setting: settings.wardrobeExtended},
  {labelKey: 'wardrobe-setting-shared', setting: settings.wardrobeShared},
  {labelKey: 'wardrobe-setting-categories', setting: settings.wardrobeCategoriesEnabled},
  {labelKey: 'wardrobe-setting-zoom', setting: settings.wardrobeZoom},
  {labelKey: 'wardrobe-setting-photo', setting: settings.wardrobePhoto},
];

const ROW_CLASS = 'flex h-[50px] shrink-0 items-center rounded-lg border border-white/8 bg-black/35 px-4';

export function GeneralTab() {
  const language = getUiLanguageSetting();

  return <div className="flex flex-col gap-3">
    <div className={`${ROW_CLASS} justify-between gap-4`}>
      <span className="text-[26px] text-[#f0eee4]">{t('wardrobe-language')}</span>
      <Select
        density="stage"
        value={language}
        onChange={event => setUiLanguage(event.currentTarget.value)}
        className="w-50"
      >
        <option value="">{t('wardrobe-language-auto')}</option>
        {SUPPORTED_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
      </Select>
    </div>

    {TOGGLE_ROWS.map(row =>
      <SettingRow key={row.setting.key} label={t(row.labelKey)} setting={row.setting} density="stage"/>)}
  </div>;
}
