import {createIndexedDbOpener, requestResult, transactionComplete} from '@/core/indexedDb';

const DB_NAME = 'liko-aee-backgrounds';
const DB_VERSION = 1;
const STORE = 'images';
export const LOCAL_BG_PREFIX = 'aee-idb-background:';

const openDb = createIndexedDbOpener(DB_NAME, DB_VERSION, [{name: STORE, options: {keyPath: 'id'}}]);

export function localBackgroundUrl(id: string): string {
  return `${LOCAL_BG_PREFIX}${id}`;
}

export function localBackgroundId(url: string): string | null {
  return url.startsWith(LOCAL_BG_PREFIX) ? url.slice(LOCAL_BG_PREFIX.length) : null;
}

export async function readBackgroundBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  const result = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id));
  return (result as {id: string; blob: Blob} | undefined)?.blob ?? null;
}

export async function writeBackgroundBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put({id, blob, updatedAt: Date.now()});
  return transactionComplete(tx);
}

export async function deleteBackgroundBlob(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(id);
  return transactionComplete(tx);
}

/** Decode and re-encode locally. The resulting WebP Blob is stored directly in IndexedDB. */
export async function imageFileToWebp(file: File, quality = 0.95): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) throw new Error('WebP encoding failed');
    return blob;
  } finally {
    bitmap.close();
  }
}
