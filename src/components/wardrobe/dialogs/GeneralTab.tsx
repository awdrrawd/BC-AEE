import {getUiLanguageSetting, setUiLanguage, SUPPORTED_LANGUAGES, LANG_FLAG_FONT, t} from '@/i18n/i18n';
import {type BooleanSetting, settings} from '@/core/settings';
import {fbcWardrobeUsage} from '@/core/wardrobeStorage';
import {SettingRow} from '@/components/ui/SettingRow';
import {Select} from '@/components/ui/Fields';

const TOGGLE_ROWS: Array<{ labelKey: string; setting: BooleanSetting }> = [
  {labelKey: 'wardrobe-setting-confirm-save', setting: settings.wardrobeConfirmSave},
  {labelKey: 'wardrobe-setting-96-slots', setting: settings.wardrobeExtended},
  {labelKey: 'wardrobe-setting-shared', setting: settings.wardrobeShared},
  {labelKey: 'wardrobe-setting-categories', setting: settings.wardrobeCategoriesEnabled},
  {labelKey: 'wardrobe-setting-zoom', setting: settings.wardrobeZoom},
  {labelKey: 'wardrobe-setting-cancel-tryon', setting: settings.wardrobeCancelTryOn},
  {labelKey: 'wardrobe-setting-photo', setting: settings.wardrobePhoto},
  {labelKey: 'wardrobe-setting-collapse-list', setting: settings.wardrobeCollapseEnabled},
  {labelKey: 'wardrobe-setting-portrait', setting: settings.wardrobePortrait},
];

const ROW_CLASS = 'flex h-[50px] shrink-0 items-center rounded-lg border border-white/8 bg-black/35 px-4';

/** Online extended-wardrobe storage meter — shown always, since data may exist even while 96 slots is off. */
function CapacityGauge() {
  const {used, budget} = fbcWardrobeUsage();
  const pct = Math.min(100, Math.round((used / budget) * 100));
  const danger = pct >= 90;
  return <div className={`${ROW_CLASS} !h-auto flex-col items-stretch gap-1.5 py-3`} title={t('wardrobe-capacity-hint')}>
    <div className="flex items-baseline justify-between text-[22px]">
      <span className="text-[#f0eee4]">{t('wardrobe-capacity-label')}</span>
      <span className={danger ? 'text-red-400' : 'text-zinc-400'}>{pct}%</span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/50">
      <div
        className="h-full rounded-full transition-[width]"
        style={{width: `${pct}%`, background: danger ? '#f87171' : 'var(--aee-accent)'}}
      />
    </div>
  </div>;
}

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
        style={{fontFamily: LANG_FLAG_FONT}}
      >
        <option value="">{t('wardrobe-language-auto')}</option>
        {SUPPORTED_LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
      </Select>
    </div>

    {TOGGLE_ROWS.map(row => <div key={row.setting.key} className="contents">
      <SettingRow label={t(row.labelKey)} setting={row.setting} density="stage"/>
      {row.setting === settings.wardrobeExtended && <CapacityGauge/>}
    </div>)}
  </div>;
}
