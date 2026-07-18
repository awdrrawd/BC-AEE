import {useSyncExternalStore} from 'react';
import type {UiStyle} from '@/core/theme';
import type {WardrobeSlotMeta, WardrobeSourceId} from '@/core/types';

const STORAGE_KEY = 'liko-aee-settings';

export interface CtrlPos {
  left: number;
  top: number;
}

class SettingsStore {
  private values: Record<string, unknown>;

  constructor(private readonly storageKey: string) {
    this.values = SettingsStore.load(storageKey);
  }

  private static load(storageKey: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  read<T>(key: string, fallback: T): T {
    return (this.values[key] as T | undefined) ?? fallback;
  }

  write<T>(key: string, value: T, persist: boolean) {
    this.values[key] = value;
    if (!persist) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.values));
    } catch {
      // localStorage can be unavailable in private or embedded contexts.
    }
  }
}

const store = new SettingsStore(STORAGE_KEY);

export class Setting<T> {
  private readonly watchers = new Set<() => void>();

  constructor(readonly key: string, readonly fallback: T) {}

  get(): T {
    return store.read(this.key, this.fallback);
  }

  set(value: T, persist = true) {
    if (Object.is(value, this.get())) return;
    store.write(this.key, value, persist);
    this.watchers.forEach(notify => notify());
  }

  subscribe = (notify: () => void): (() => void) => {
    this.watchers.add(notify);
    return () => this.watchers.delete(notify);
  };

  getSnapshot = (): T => this.get();

  onChange(listener: (value: T) => void) {
    this.watchers.add(() => listener(this.get()));
  }
}

export class BooleanSetting extends Setting<boolean> {
  toggle(): boolean {
    const next = !this.get();
    this.set(next);
    return next;
  }
}

export function useSetting<T>(setting: Setting<T>): T {
  return useSyncExternalStore(setting.subscribe, setting.getSnapshot);
}

function bool(key: string, fallback: boolean) {
  return new BooleanSetting(key, fallback);
}

function value<T>(key: string, fallback: T) {
  return new Setting<T>(key, fallback);
}

export const settings = {
  hoverHighlight: bool('hoverHighlight', false),
  hoverHighlightChar: bool('hoverHighlightChar', false),
  hoverTryOn: bool('hoverTryOn', false),
  enableCopyPaste: bool('enableCopyPaste', false),
  hideLscgLayers: bool('hideLscgLayers', false),
  enableAeeMenu: bool('enableAeeMenu', false),
  useAeeColorPicker: bool('useAeeColorPicker', false),
  pasteImport: bool('pasteImport', false),
  bcWheelScroll: bool('bcWheelScroll', false),
  enablePartsFilter: bool('enablePartsFilter', false),
  enableWardrobe: bool('enableWardrobe', false),

  showCharCtrl: bool('showCharCtrl', false),
  hideCloseup: bool('hideCloseup', false),
  hideFullbody: bool('hideFullbody', false),
  fullbodyOffsetX: value('fullbodyOffsetX', 0),
  charCtrlPos: value<CtrlPos | null>('charCtrlPos', null),
  ctrlExpandUp: bool('ctrlExpandUp', true),
  ctrlSubLeft: bool('ctrlSubLeft', true),

  charOffsetX: value('charOffsetX', 0),
  charOffsetY: value('charOffsetY', 0),
  charScale: value('charScale', 1),

  bgEnabled: bool('bgEnabled', false),
  bgColor: value('bgColor', '#87CEEB'),
  bgGridEnabled: bool('bgGridEnabled', false),
  bgGridMode: value<'line' | 'checker'>('bgGridMode', 'line'),
  bgGridPx: value('bgGridPx', 25),
  bgGridColor: value('bgGridColor', '#ffffff'),
  bgGridOpacity: value('bgGridOpacity', 0.25),
  bgGridLayer: value<'below' | 'above'>('bgGridLayer', 'below'),
  bgImgEnabled: bool('bgImgEnabled', false),
  bgImgUrl: value('bgImgUrl', ''),

  wardrobeExtended: bool('wardrobeExtended', true),
  wardrobeShared: bool('wardrobeSharedAcrossAccounts', false),
  wardrobeSource: value<WardrobeSourceId>('wardrobeSource', 'online'),
  wardrobeMetaMigrated: bool('wardrobeMetaMigrated', false),
  wardrobeCategoriesEnabled: bool('wardrobeCategoriesEnabled', false),
  wardrobeZoom: bool('wardrobeZoomEnabled', false),
  wardrobeIncludeBody: bool('wardrobeIncludeBody', true),
  wardrobeIncludeItems: bool('wardrobeIncludeItems', true),
  wardrobeCategories: value<string[]>('wardrobeCategories', ['Category 1', 'Category 2', 'Category 3']),
  wardrobeBgImage: value('wardrobeBgImage', 'Backgrounds/Private.jpg'),
  wardrobeSlotMeta: value<Record<string, WardrobeSlotMeta>>('wardrobeSlotMeta', {}),

  uiLanguage: value('uiLanguage', ''),
  themePreset: value('wardrobeThemePreset', ''),
  themeAccent: value('wardrobeThemeAccent', ''),
  themeUiStyle: value<UiStyle | ''>('wardrobeThemeUiStyle', ''),
};
