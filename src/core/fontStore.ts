// Loads custom item fonts as FontFaces and caches their bytes in IndexedDB so a large .ttf
// is downloaded from its host only once, then served locally on every later session.
import {type CustomFontDef, customFontFamily, customFontUrl} from '@/core/fonts';

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
let onReady: (() => void) | null = null;
let onError: ((id: string, reason: string) => void) | null = null;

/** Registers a callback fired whenever a font finishes loading (used to trigger a redraw). */
export function setFontReadyListener(listener: () => void) {
  onReady = listener;
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
  let buffer = await readCachedFont(def.id).catch(() => null);
  if (!buffer) {
    const response = await fetch(customFontUrl(def));
    if (!response.ok) throw new Error(`font ${def.id}: HTTP ${response.status}`);
    buffer = await response.arrayBuffer();
    // Cache best-effort — a failed write shouldn't stop us using the font this session.
    writeCachedFont(def.id, buffer).catch(error => console.warn('🐈‍⬛ [AEE] Failed to cache font', def.id, error));
  }
  const face = new FontFace(customFontFamily(def.id), buffer);
  await face.load();
  (document.fonts as FontFaceSet).add(face);
  return true;
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
          onReady?.();
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
