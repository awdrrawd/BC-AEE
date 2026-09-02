import {settings} from '@/core/settings';
import {runtime} from '@/core/runtime';

const EXTENSION_KEY = 'AEE';

interface AppearanceQuickSettings {
  hoverTryOnClothingEnabled?: boolean;
  hoverTryOnItemEnabled?: boolean;
  characterPreviewActive?: boolean;
}

function record(): AppearanceQuickSettings | null {
  if (!Player) return null;
  Player.ExtensionSettings ??= {};
  const root = Player.ExtensionSettings as Record<string, unknown>;
  const aee = root[EXTENSION_KEY];
  if (!aee || typeof aee !== 'object' || Array.isArray(aee)) root[EXTENSION_KEY] = {};
  return root[EXTENSION_KEY] as AppearanceQuickSettings;
}

export function loadAppearanceQuickSettings() {
  const saved = record();
  if (!saved) return;
  const clothing = typeof saved.hoverTryOnClothingEnabled === 'boolean'
    ? saved.hoverTryOnClothingEnabled
    : false;
  const item = typeof saved.hoverTryOnItemEnabled === 'boolean'
    ? saved.hoverTryOnItemEnabled
    : false;
  runtime.hoverTryOnClothingEnabled = clothing;
  runtime.hoverTryOnItemEnabled = item;
  if (typeof saved.characterPreviewActive === 'boolean') settings.characterPreviewActive.set(saved.characterPreviewActive, false);
}

export function saveAppearanceQuickSetting<K extends keyof AppearanceQuickSettings>(key: K, value: AppearanceQuickSettings[K]) {
  const saved = record();
  if (!saved) return;
  saved[key] = value;
  ServerPlayerExtensionSettingsSync(EXTENSION_KEY);
}
