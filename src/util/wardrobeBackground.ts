import type {CSSProperties} from 'react';
import {t} from '@/i18n/i18n';
import {CUSTOM_BG_PATH, readCustomBackground} from '@/core/wardrobeStorage';
import {settings} from '@/core/settings';

const COLOR_BG_PREFIX = 'color:';
const FALLBACK_BG_COLOR = '#1a1a1a';

export function colorBackgroundPath(color: string): string {
  return COLOR_BG_PREFIX + color;
}

export function isColorBackground(path: string): boolean {
  return path.startsWith(COLOR_BG_PREFIX);
}

export function backgroundColorValue(path: string): string {
  const color = isColorBackground(path) ? path.slice(COLOR_BG_PREFIX.length) : '';
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : FALLBACK_BG_COLOR;
}

export function backgroundUrl(path: string): string | null {
  if (isColorBackground(path)) return null;
  if (path === CUSTOM_BG_PATH) return readCustomBackground();
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return path;
}

export function backgroundStyle(path: string = settings.wardrobeBgImage.get()): CSSProperties {
  if (isColorBackground(path)) {
    return {backgroundColor: backgroundColorValue(path)};
  }

  const url = backgroundUrl(path);
  return {
    backgroundColor: '#0d0d14',
    backgroundImage: url ? `url("${url}")` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

export function backgroundDisplayName(): string {
  const path = settings.wardrobeBgImage.get();
  if (isColorBackground(path)) return t('wardrobe-bg-solid-prefix') + backgroundColorValue(path);
  if (path === CUSTOM_BG_PATH) return t('wardrobe-bg-custom-local');
  if (/^https?:\/\//i.test(path)) return t('wardrobe-bg-url-image');
  return path;
}
