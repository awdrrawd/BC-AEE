// Item-font catalogue. Custom fonts are hosted externally (GitHub Releases / raw) because the
// .ttf files are far too large to bundle; they're downloaded once and cached in IndexedDB.
// System fonts need no download — they resolve to whatever the viewer's OS provides.

export interface CustomFontDef {
  id: string;
  /** Display name shown in the picker. */
  name: string;
  /** File name appended to FONT_BASE_URL, or a full https URL. */
  file: string;
}

export interface SystemFontDef {
  id: string;
  name: string;
  /** CSS font-family stack. */
  family: string;
}

/**
 * Base URL the custom .ttf files are served from. Uses raw.githubusercontent.com because it
 * sends `Access-Control-Allow-Origin: *` (the fonts are fetched cross-origin from the BC page).
 * The files live committed in this repo under releases/download/fonts/.
 * A `file` that already starts with http(s) ignores this.
 */
export const FONT_BASE_URL = 'https://raw.githubusercontent.com/awdrrawd/BC-AEE/main/releases/download/fonts/';

/** Fonts downloaded on demand and cached in IndexedDB. Add entries here as you host more. */
export const CUSTOM_FONTS: readonly CustomFontDef[] = [
  {id: 'soukou-mincho', name: '装甲明朝 (SoukouMincho)', file: 'SoukouMincho.ttf'},
  {id: 'tegaki-851', name: '851手書き雑フォント', file: '851-tegaki.ttf'},
];

/** Always-available families; browsers fall back silently when the OS lacks one. */
export const SYSTEM_FONTS: readonly SystemFontDef[] = [
  {id: 'sys:sans', name: 'Sans-serif', family: 'sans-serif'},
  {id: 'sys:serif', name: 'Serif', family: 'serif'},
  {id: 'sys:mono', name: 'Monospace', family: 'monospace'},
  {id: 'sys:arial', name: 'Arial', family: 'Arial, sans-serif'},
  {id: 'sys:times', name: 'Times New Roman', family: '"Times New Roman", serif'},
  {id: 'sys:jhenghei', name: '微軟正黑體 (JhengHei)', family: '"Microsoft JhengHei", "Microsoft YaHei", sans-serif'},
  {id: 'sys:mingliu', name: '細明體 / 宋体 (MingLiU)', family: '"PMingLiU", "SimSun", serif'},
  {id: 'sys:msgothic', name: 'MS ゴシック (MS Gothic)', family: '"MS Gothic", sans-serif'},
  {id: 'sys:msmincho', name: 'MS 明朝 (MS Mincho)', family: '"MS Mincho", serif'},
];

/** Sentinel id meaning "no override — use Bondage Club's default font". */
export const DEFAULT_FONT_ID = 'default';

const CUSTOM_FONT_FAMILY_PREFIX = 'AEE-';

export function customFontFamily(id: string): string {
  return CUSTOM_FONT_FAMILY_PREFIX + id;
}

export function customFontUrl(def: CustomFontDef): string {
  return /^https?:\/\//.test(def.file) ? def.file : FONT_BASE_URL + def.file;
}

export function findCustomFont(id: string): CustomFontDef | undefined {
  return CUSTOM_FONTS.find(font => font.id === id);
}

export function findSystemFont(id: string): SystemFontDef | undefined {
  return SYSTEM_FONTS.find(font => font.id === id);
}
