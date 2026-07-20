// IndexedDB store for the local (offline) wardrobe. localStorage caps out around a few MB,
// which silently limited the local wardrobe to a handful of outfits — IndexedDB has no such cap.
// One record per storage scope; the whole scope's outfits/names are read and written together.

const DB_NAME = 'liko-aee-wardrobe';
const DB_VERSION = 1;
const STORE = 'local';

export interface LocalWardrobeRecord {
  scope: string;
  outfits: ItemBundle[][];
  names: string[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: 'scope'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  // A failed open shouldn't poison every later attempt.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export async function readLocalWardrobeRecord(scope: string): Promise<LocalWardrobeRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(scope);
    request.onsuccess = () => resolve((request.result as LocalWardrobeRecord) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function writeLocalWardrobeRecord(record: LocalWardrobeRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
