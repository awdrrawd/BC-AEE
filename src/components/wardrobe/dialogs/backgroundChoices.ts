import {t} from '@/i18n/i18n';
import {CUSTOM_BG_PATH} from '@/core/wardrobeStorage';
import {isColorBackground} from '@/util/wardrobeBackground';
import type {BackgroundChoiceType} from '@/core/types';

export interface BackgroundChoice {
  label: string;
  type: BackgroundChoiceType;
  path?: string;
}

export const BACKGROUND_CHOICES: BackgroundChoice[] = [
  {label: 'wardrobe-bg-solid', type: 'color'},
  {label: 'wardrobe-bg-private', type: 'image', path: 'Backgrounds/Private.jpg'},
  {label: 'Sheet', type: 'image', path: 'Backgrounds/Sheet.jpg'},
  {label: 'Dungeon', type: 'image', path: 'Backgrounds/Dungeon.jpg'},
  {label: 'wardrobe-bg-upload', type: 'upload'},
  {label: 'wardrobe-bg-url', type: 'url'},
  {label: 'wardrobe-bg-custom-path', type: 'custom'},
];

export function isChoiceSelected(choice: BackgroundChoice, current: string): boolean {
  switch (choice.type) {
    case 'color':
      return isColorBackground(current);
    case 'upload':
      return current === CUSTOM_BG_PATH;
    case 'url':
      return /^https?:\/\//i.test(current);
    case 'image':
      return choice.path === current;
    default:
      return false;
  }
}

export function backgroundChoiceLabel(choice: BackgroundChoice): string {
  return choice.label.startsWith('wardrobe-') ? t(choice.label) : choice.label;
}

export const BACKGROUND_PREVIEW_CLASS = 'flex h-[50px] w-full items-center justify-center overflow-hidden rounded-lg bg-black/35 bg-cover bg-center';
