import {SUPPORTED_LANGUAGES, getUiLanguageSetting, setUiLanguage, t} from '@/i18n/i18n';

export function LanguageSelect() {
  const value = getUiLanguageSetting();
  return <div className="flex items-center justify-between gap-2 border-b border-zinc-800 py-2"
              title={t('settings-language-label')}>
    <span className="text-xs text-zinc-300">{t('settings-language-label')}</span>
    <select
      className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-100 outline-none focus:border-violet-400"
      value={value}
      onChange={event => setUiLanguage(event.target.value)}
    >
      <option value="">{t('settings-language-auto')}</option>
      {SUPPORTED_LANGUAGES.map(lang =>
        <option key={lang.code} value={lang.code}>{lang.label}</option>
      )}
    </select>
  </div>;
}
