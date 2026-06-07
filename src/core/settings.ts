const SETTINGS_KEY = 'liko-aee-settings';

const settings: Record<string, unknown> = (() => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
})();

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage can be unavailable in private or embedded contexts.
  }
}

export function getAeeSetting<T>(key: string, fallback: T): T {
  return (settings[key] as T | undefined) ?? fallback;
}

export function setAeeSetting<T>(key: string, value: T) {
  settings[key] = value;
  saveSettings();
}
