import type {CSSProperties} from 'react';
import {settings} from '@/core/settings';
import {hexToRgba} from '@/util/color';

export type UiStyle = 'elegant' | 'minimal' | 'neon' | 'court' | 'dressing';

export interface UiTheme {
  preset: string;
  accent: string;
  uiStyle: UiStyle;
  base: string;
  baseOpacity: number;
  cardOpacity: number;
}

// The base-opacity slider is the actual opacity of the translucent side panels (list/manage/preview).
export const DEFAULT_BASE_OPACITY = 0.5;
export const DEFAULT_CARD_OPACITY = 0.5;
// Solid dialogs never drop below this, so settings/menus stay readable regardless of the slider.
const DIALOG_MIN_OPACITY = 0.96;

export interface UiThemePreset {
  id: string;
  name: string;
  accent: string;
  uiStyle: UiStyle;
}

export const UI_STYLES: UiStyle[] = ['minimal', 'elegant', 'neon', 'court', 'dressing'];

export const UI_STYLE_LABEL_KEYS: Record<UiStyle, string> = {
  elegant: 'wardrobe-ui-style-elegant',
  minimal: 'wardrobe-ui-style-minimal',
  neon: 'wardrobe-ui-style-neon',
  court: 'wardrobe-ui-style-court',
  dressing: 'wardrobe-ui-style-dressing',
};

export const THEME_PRESETS: UiThemePreset[] = [
  {id: 'gold', name: 'wardrobe-theme-gold', accent: '#e3cf62', uiStyle: 'elegant'},
  {id: 'sapphire', name: 'wardrobe-theme-sapphire', accent: '#5b9bd5', uiStyle: 'minimal'},
  {id: 'emerald', name: 'wardrobe-theme-emerald', accent: '#4ade80', uiStyle: 'minimal'},
  {id: 'rose', name: 'wardrobe-theme-rose', accent: '#f472b6', uiStyle: 'elegant'},
  {id: 'amethyst', name: 'wardrobe-theme-amethyst', accent: '#a78bfa', uiStyle: 'elegant'},
  {id: 'iris', name: 'wardrobe-theme-iris', accent: '#7648fe', uiStyle: 'neon'},
  {id: 'crimson', name: 'wardrobe-theme-crimson', accent: '#ef4444', uiStyle: 'elegant'},
  {id: 'cyan', name: 'wardrobe-theme-cyan', accent: '#22d3ee', uiStyle: 'neon'},
  {id: 'royal', name: 'wardrobe-theme-royal', accent: '#c9a227', uiStyle: 'court'},
  {id: 'boudoir', name: 'wardrobe-theme-boudoir', accent: '#d4a574', uiStyle: 'dressing'},
];

const DEFAULT_THEME = THEME_PRESETS.find(preset => preset.id === 'sapphire') ?? THEME_PRESETS[0];

export function readUiTheme(): UiTheme {
  return {
    preset: settings.themePreset.get() || DEFAULT_THEME.id,
    accent: settings.themeAccent.get() || DEFAULT_THEME.accent,
    uiStyle: settings.themeUiStyle.get() || DEFAULT_THEME.uiStyle,
    base: settings.themeBase.get(),
    baseOpacity: settings.themeBaseOpacity.get(),
    cardOpacity: settings.themeCardOpacity.get(),
  };
}

export function writeUiTheme(theme: UiTheme) {
  settings.themePreset.set(theme.preset);
  settings.themeAccent.set(theme.accent);
  settings.themeUiStyle.set(theme.uiStyle);
  settings.themeBase.set(theme.base);
  settings.themeBaseOpacity.set(theme.baseOpacity);
  settings.themeCardOpacity.set(theme.cardOpacity);
}

export function uiAccent(theme: UiTheme): string {
  return theme.accent;
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function uiThemeVariables(theme: UiTheme): CSSProperties {
  const accent = uiAccent(theme);
  const baseHex = HEX_COLOR.test(theme.base) ? theme.base : styleBaseHex(theme.uiStyle);
  // baseOpacity is the visible opacity of the translucent side panels; dialogs stay solid.
  const baseOpacity = clampOpacity(theme.baseOpacity, DEFAULT_BASE_OPACITY);
  const cardOpacity = clampOpacity(theme.cardOpacity, DEFAULT_CARD_OPACITY);
  return {
    '--aee-accent': accent,
    '--aee-accent-08': hexToRgba(accent, 0.08),
    '--aee-accent-16': hexToRgba(accent, 0.16),
    '--aee-accent-22': hexToRgba(accent, 0.22),
    '--aee-accent-35': hexToRgba(accent, 0.35),
    '--aee-accent-55': hexToRgba(accent, 0.55),
    '--aee-accent-65': hexToRgba(accent, 0.65),
    '--aee-text': '#e4e4e7',
    '--aee-text-strong': '#fafafa',
    '--aee-text-muted': '#a1a1aa',
    '--aee-control-bg': 'rgba(39,39,52,0.78)',
    '--aee-control-hover': 'rgba(63,63,78,0.92)',
    '--aee-field-bg': 'rgba(18,18,26,0.86)',
    '--aee-panel-bg': hexToRgba(baseHex, Math.max(baseOpacity, DIALOG_MIN_OPACITY)),
    '--aee-panel-bg-soft': hexToRgba(baseHex, baseOpacity),
    '--aee-panel-border': panelBorder(theme.uiStyle, accent),
    '--aee-panel-radius': '8px',
    '--aee-panel-shadow': panelShadow(theme.uiStyle, accent),
    '--aee-card-bg': `rgba(16,16,24,${cardOpacity})`,
  } as CSSProperties;
}

function clampOpacity(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

// Solid RGB base per UI style; the alpha comes from the base-opacity control.
function styleBaseHex(uiStyle: UiStyle): string {
  switch (uiStyle) {
    case 'neon': return '#090910';
    case 'court': return '#181410';
    case 'dressing': return '#1e1916';
    default: return '#09090b';
  }
}

function panelBorder(uiStyle: UiStyle, accent: string): string {
  if (uiStyle === 'neon') return `1px solid ${hexToRgba(accent, 0.85)}`;
  if (uiStyle === 'court') return `2px solid ${hexToRgba(accent, 0.75)}`;
  if (uiStyle === 'dressing') return '1px solid rgba(160,130,100,0.55)';
  if (uiStyle === 'elegant') return `1px solid ${hexToRgba(accent, 0.45)}`;
  return '1px solid rgba(255,255,255,0.12)';
}

function panelShadow(uiStyle: UiStyle, accent: string): string {
  if (uiStyle === 'neon') return `0 0 16px ${hexToRgba(accent, 0.4)}`;
  if (uiStyle === 'court') return `inset 0 0 0 1px ${hexToRgba(accent, 0.3)}, 0 18px 40px rgba(0,0,0,0.4)`;
  return '0 18px 40px rgba(0,0,0,0.42)';
}
