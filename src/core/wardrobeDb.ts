// IndexedDB store for the local (offline) wardrobe. localStorage caps out around a few MB,
// which silently limited the local wardrobe to a handful of outfits — IndexedDB has no such cap.
// One record per storage scope; the whole scope's outfits/names are read and written together.

import {createIndexedDbOpener, requestResult, transactionComplete} from '@/core/indexedDb';

const DB_NAME = 'liko-aee-wardrobe';
const DB_VERSION = 1;
const STORE = 'local';

export interface LocalWardrobeRecord {
  scope: string;
  outfits: ItemBundle[][];
  names: string[];
}

const openDb = createIndexedDbOpener(DB_NAME, DB_VERSION, [{name: STORE, options: {keyPath: 'scope'}}]);

export async function readLocalWardrobeRecord(scope: string): Promise<LocalWardrobeRecord | null> {
  const db = await openDb();
  const result = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(scope));
  return (result as LocalWardrobeRecord | undefined) ?? null;
}

export async function writeLocalWardrobeRecord(record: LocalWardrobeRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(record);
  return transactionComplete(tx);
}
