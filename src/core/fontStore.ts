// Loads custom item fonts as FontFaces and caches their bytes in IndexedDB so a large .ttf
// is downloaded from its host only once, then served locally on every later session.
import {CUSTOM_FONT_FAMILY_PREFIX, type CustomFontDef, customFontFamily, customFontUrl} from '@/core/fonts';

const DB_NAME = 'liko-aee-fonts';
const DB_VERSION = 1;
const STORE = 'fonts';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: 'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

async function readCachedFont(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as {id: string; buffer: ArrayBuffer} | undefined)?.buffer ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeCachedFont(id: string, buffer: ArrayBuffer): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({id, buffer});
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const ready = new Set<string>();
const loading = new Map<string, Promise<boolean>>();
const changeListeners = new Set<() => void>();
let onError: ((id: string, reason: string) => void) | null = null;
let version = 0;

/** Monotonic counter bumped on every font-set change — a snapshot for React's useSyncExternalStore. */
export function getFontsVersion(): number {
  return version;
}

function notifyChange() {
  version++;
  changeListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Font change listener failed', error);
    }
  });
}

/**
 * Subscribes to font-set changes (a font finished loading, or the cache was cleared).
 * Used to trigger a redraw and to re-render the font picker. Returns an unsubscribe fn.
 */
export function subscribeFonts(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** Registers a callback fired when a font fails to download/load (used to surface a toast). */
export function setFontErrorListener(listener: (id: string, reason: string) => void) {
  onError = listener;
}

/** True once the font's FontFace is loaded and registered — safe to draw with. */
export function isCustomFontReady(id: string): boolean {
  return ready.has(id);
}

async function loadCustomFont(def: CustomFontDef): Promise<boolean> {
  const cached = await readCachedFont(def.id).catch(() => null);
  const buffer = cached ?? await fetchFontBytes(def);

  // Parse/register the font BEFORE caching. Some fonts are byte-valid but rejected by the
  // browser's OpenType sanitizer ("Invalid font data in ArrayBuffer") — caching only after a
  // successful load() means a rejected font is never persisted, so a later fix isn't masked
  // by a bad cache entry.
  const face = new FontFace(customFontFamily(def.id), buffer);
  await face.load();
  (document.fonts as FontFaceSet).add(face);

  if (!cached) {
    // Cache best-effort — a failed write shouldn't stop us using the font this session.
    writeCachedFont(def.id, buffer).catch(error => console.warn('🐈‍⬛ [AEE] Failed to cache font', def.id, error));
  }
  return true;
}

async function fetchFontBytes(def: CustomFontDef): Promise<ArrayBuffer> {
  const response = await fetch(customFontUrl(def));
  if (!response.ok) throw new Error(`font ${def.id}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

/**
 * Ensures a custom font is loaded. Returns true if it's ready right now; otherwise starts an
 * async load (deduped) and returns false so the caller can fall back to the default font until
 * the ready listener fires.
 */
export function ensureCustomFontLoaded(def: CustomFontDef): boolean {
  if (ready.has(def.id)) return true;
  if (!loading.has(def.id)) {
    const promise = loadCustomFont(def)
      .then(ok => {
        if (ok) {
          ready.add(def.id);
          notifyChange();
        }
        return ok;
      })
      .catch(error => {
        console.warn('🐈‍⬛ [AEE] Failed to load font', def.id, error);
        onError?.(def.id, error instanceof Error ? error.message : String(error));
        return false;
      })
      .finally(() => loading.delete(def.id));
    loading.set(def.id, promise);
  }
  return false;
}

async function clearFontCacheDb(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Forgets every preloaded custom font: drops the in-memory ready set, unregisters the AEE
 * FontFaces from the document, and empties the IndexedDB byte cache so nothing is kept on disk.
 * Notifies subscribers so items redraw with the default font until something reloads.
 */
export async function clearAllFonts(): Promise<void> {
  ready.clear();
  loading.clear();
  try {
    const fonts = document.fonts as FontFaceSet;
    // Snapshot first — deleting while iterating the live set is unsafe.
    const ours: FontFace[] = [];
    fonts.forEach(face => {
      if (face.family.startsWith(CUSTOM_FONT_FAMILY_PREFIX)) ours.push(face);
    });
    ours.forEach(face => fonts.delete(face));
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to unregister fonts', error);
  }
  await clearFontCacheDb().catch(error => console.warn('🐈‍⬛ [AEE] Failed to clear font cache', error));
  notifyChange();
}
