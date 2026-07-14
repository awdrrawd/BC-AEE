import i18next, {type TOptions} from 'i18next';
import {initReactI18next} from 'react-i18next';
import {emitAeeStoreChange} from '@/core/store';
import {settings} from '@/core/settings';
import en from '@/i18n/locales/EN/translation.json';
import de from '@/i18n/locales/DE/translation.json';
import fr from '@/i18n/locales/FR/translation.json';
import ru from '@/i18n/locales/RU/translation.json';
import cn from '@/i18n/locales/CN/translation.json';
import tw from '@/i18n/locales/TW/translation.json';
import ua from '@/i18n/locales/UA/translation.json';
import ja from '@/i18n/locales/JA/translation.json';
import ko from '@/i18n/locales/KO/translation.json';

declare const TranslationLanguage: string | undefined;

const DEFAULT_LANGUAGE = 'EN';

const LANGUAGE_MAP: Record<string, string> = {
  EN: 'EN',
  DE: 'DE',
  FR: 'FR',
  RU: 'RU',
  CN: 'CN',
  TW: 'TW',
  UA: 'UA',
  UK: 'UA',
  UKR: 'UA',
  JA: 'JA',
  JP: 'JA',
  KO: 'KO',
  KR: 'KO',
  'de-DE': 'DE',
  'fr-FR': 'FR',
  'ru-RU': 'RU',
  ZH: 'CN',
  'ZH-CN': 'CN',
  'ZH-HANS': 'CN',
  'ZH-TW': 'TW',
  'ZH-HANT': 'TW',
  'zh-CN': 'CN',
  'zh-Hans': 'CN',
  'zh-TW': 'TW',
  'zh-Hant': 'TW',
  'uk-UA': 'UA',
  'ja-JP': 'JA',
  'ko-KR': 'KO',
};

const resources = {
  EN: {translation: en},
  DE: {translation: de},
  FR: {translation: fr},
  RU: {translation: ru},
  CN: {translation: cn},
  TW: {translation: tw},
  UA: {translation: ua},
  JA: {translation: ja},
  KO: {translation: ko},
} as const;

// Languages the user can pick from the settings dropdown. Labels are shown in
// their own language so they're recognizable regardless of current UI language.
export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  {code: 'EN', label: 'English'},
  {code: 'TW', label: '繁體中文'},
  {code: 'CN', label: '简体中文'},
  {code: 'JA', label: '日本語'},
  {code: 'KO', label: '한국어'},
  {code: 'DE', label: 'Deutsch'},
  {code: 'FR', label: 'Français'},
  {code: 'RU', label: 'Русский'},
  {code: 'UA', label: 'Українська'},
];

export type LocalizedText = string | Record<string, string>;

export function normalizeLanguage(language: string | undefined): string {
  if (!language) return DEFAULT_LANGUAGE;
  return LANGUAGE_MAP[language] ?? LANGUAGE_MAP[language.toUpperCase()] ?? DEFAULT_LANGUAGE;
}

function readBcLanguage(): string | undefined {
  return typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : undefined;
}

function refreshAppForLanguageChange(): void {
  emitAeeStoreChange();
}

// The user's explicit override ('' / undefined means "follow the game").
export function getUiLanguageSetting(): string {
  return settings.uiLanguage.get();
}

function resolveInitialLanguage(): string {
  const override = getUiLanguageSetting();
  return override ? normalizeLanguage(override) : normalizeLanguage(readBcLanguage());
}

// Called by the settings UI. An empty code clears the override and resumes
// following the game's language.
export function setUiLanguage(code: string): void {
  settings.uiLanguage.set(code);
  const next = code ? normalizeLanguage(code) : normalizeLanguage(readBcLanguage());
  lastLanguage = next;
  i18next.changeLanguage(next)
    .then(() => refreshAppForLanguageChange())
    .catch(error => console.error(`Failed to change language to ${next}:`, error));
}

i18next
  .use(initReactI18next)
  .init({
    lng: resolveInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    resources,
    initAsync: false,
    interpolation: {
      escapeValue: false,
      prefix: '{',
      suffix: '}',
    },
    returnNull: false,
    returnEmptyString: false,
    missingKeyHandler: (_lngs, _namespace, key) => {
      console.warn(`Missing translation: ${key}`);
    },
    saveMissing: true,
  })
  .catch(error => {
    console.error('Failed to initialize i18n:', error);
  });

let lastLanguage = i18next.language || DEFAULT_LANGUAGE;

setInterval(() => {
  // Once the user picks a language explicitly, stop following the game.
  if (getUiLanguageSetting()) return;
  const nextLanguage = normalizeLanguage(readBcLanguage());

  if (nextLanguage !== lastLanguage) {
    lastLanguage = nextLanguage;
    i18next.changeLanguage(nextLanguage).catch(error => {
      console.error(`Failed to change language to ${nextLanguage}:`, error);
    });

    refreshAppForLanguageChange();
  }
}, 5000);

export function currentLanguage(): string {
  return lastLanguage || DEFAULT_LANGUAGE;
}

export function isZh(): boolean {
  const language = currentLanguage();
  return language === 'CN' || language === 'TW';
}

export function formatLocalizedText(
  value: LocalizedText | undefined,
  language = currentLanguage(),
  fallback = '',
): string {
  if (typeof value === 'string') return value || fallback;
  if (!value) return fallback;

  const normalizedLanguage = language.toLowerCase();
  const matchedLanguage = Object.keys(value).find(key => key.toLowerCase() === normalizedLanguage);

  return value[language]
    || (matchedLanguage ? value[matchedLanguage] : undefined)
    || value.EN
    || value.en
    || Object.values(value)[0]
    || fallback;
}

export function t(key: string, variables?: Record<string, string | number>): string {
  const options: TOptions = {
    defaultValue: `missing translation: ${key}`,
    ...(variables ?? {}),
  };

  return i18next.t(key, options);
}

export {i18next};
export default t;
