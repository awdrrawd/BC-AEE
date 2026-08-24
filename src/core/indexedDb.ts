export interface IndexedDbStoreDefinition {
  name: string;
  options?: IDBObjectStoreParameters;
}

export function createIndexedDbOpener(
  name: string,
  version: number,
  stores: readonly IndexedDbStoreDefinition[],
): () => Promise<IDBDatabase> {
  let pending: Promise<IDBDatabase> | null = null;

  return () => {
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of stores) {
          if (!db.objectStoreNames.contains(store.name)) db.createObjectStore(store.name, store.options);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    pending.catch(() => {
      pending = null;
    });
    return pending;
  };
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
