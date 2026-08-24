import {settings} from '@/core/settings';
import {runtime} from '@/core/runtime';

const EXTENSION_KEY = 'AEE';

interface AppearanceQuickSettings {
  hoverTryOnEnabled?: boolean;
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
  if (typeof saved.hoverTryOnEnabled === 'boolean') {
    runtime.hoverTryOnEnabled = saved.hoverTryOnEnabled;
    settings.hoverTryOnActive.set(saved.hoverTryOnEnabled);
  } else {
    runtime.hoverTryOnEnabled = settings.hoverTryOnActive.get();
  }
  if (typeof saved.characterPreviewActive === 'boolean') settings.characterPreviewActive.set(saved.characterPreviewActive, false);
}

export function saveAppearanceQuickSetting<K extends keyof AppearanceQuickSettings>(key: K, value: AppearanceQuickSettings[K]) {
  const saved = record();
  if (!saved) return;
  saved[key] = value;
  ServerPlayerExtensionSettingsSync(EXTENSION_KEY);
}
