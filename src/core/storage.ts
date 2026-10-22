// The only module that touches localStorage. Every caller gets the same behaviour:
//  - storage that is missing, blocked or full never throws; reads fall back, writes report false;
//  - JSON that is malformed or has the wrong shape is treated as absent;
//  - a failed write warns once per key, so lost persistence is visible without flooding the console.
// Keys are never renamed here: existing users' data lives under them.

export const STORAGE_KEYS = {
  settings: 'liko-aee-settings',
  recentColors: 'liko-aee-recent-colors',
  debug: 'liko-aee-debug',
  // Legacy keys, only read to migrate data into IndexedDB and then removed.
  wardrobeBackground: 'liko-aee-wardrobe-bg',
  localWardrobePrefix: 'liko-aee-wardrobe-local:',
  onlineBackupPrefix: 'liko-aee-wardrobe-backup:',
} as const;

const warnedKeys = new Set<string>();

// Even reading the property can throw (sandboxed iframes, blocked cookies), so every access goes through here.
function area(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function warnWriteFailure(key: string, error: unknown) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`🐈‍⬛ [AEE] Could not save "${key}" to localStorage; it will not persist after a reload.`, error);
}

export function readText(key: string): string | null {
  try {
    return area()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string): boolean {
  try {
    const storage = area();
    if (!storage) throw new Error('localStorage is unavailable');
    storage.setItem(key, value);
    return true;
  } catch (error) {
    warnWriteFailure(key, error);
    return false;
  }
}

export function removeKey(key: string): boolean {
  try {
    const storage = area();
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Parsed JSON, or `fallback` when the key is absent, unparsable or rejected by `isValid`. */
export function readJson<T>(key: string, fallback: T, isValid?: (value: unknown) => boolean): T {
  const raw = readText(key);
  if (raw == null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return !isValid || isValid(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    warnWriteFailure(key, error);
    return false;
  }
  return writeText(key, text);
}
