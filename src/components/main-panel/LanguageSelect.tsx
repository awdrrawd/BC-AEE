import {getUiLanguageSetting, setUiLanguage, SUPPORTED_LANGUAGES, LANG_FLAG_FONT, t} from '@/i18n/i18n';
import {Select} from '@/components/ui/Fields';

export function LanguageSelect() {
  const value = getUiLanguageSetting();
  return <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-1 py-2 transition-colors hover:border-(--aee-accent-55) hover:bg-(--aee-accent-16)"
              data-aee-tooltip={t('settings-language-label')}>
    <span className="text-xs text-zinc-300">{t('settings-language-label')}</span>
    <Select
      value={value}
      onValueChange={setUiLanguage}
      ariaLabel={t('settings-language-label')}
      style={{fontFamily: LANG_FLAG_FONT}}
    >
      <option value="">{t('settings-language-auto')}</option>
      {SUPPORTED_LANGUAGES.map(lang =>
        <option key={lang.code} value={lang.code}>{lang.label}</option>
      )}
    </Select>
  </div>;
}
