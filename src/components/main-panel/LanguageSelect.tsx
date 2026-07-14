import {getUiLanguageSetting, setUiLanguage, SUPPORTED_LANGUAGES, t} from '@/i18n/i18n';
import {Select} from '@/components/ui/Fields';

export function LanguageSelect() {
  const value = getUiLanguageSetting();
  return <div className="flex items-center justify-between gap-2 border-b border-zinc-800 py-2"
              title={t('settings-language-label')}>
    <span className="text-xs text-zinc-300">{t('settings-language-label')}</span>
    <Select
      value={value}
      onChange={event => setUiLanguage(event.target.value)}
    >
      <option value="">{t('settings-language-auto')}</option>
      {SUPPORTED_LANGUAGES.map(lang =>
        <option key={lang.code} value={lang.code}>{lang.label}</option>
      )}
    </Select>
  </div>;
}
