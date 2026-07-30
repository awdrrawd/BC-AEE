// Tiny bounded LRU cache. Content-keyed caches in this module (decoded images,
// GL textures, mask composites) are keyed by drawing content, which changes on
// every edit — without a cap they grow forever over a long session. This caps
// each cache at `maxSize` entries and evicts the least-recently-used one
// (optionally releasing an external resource, e.g. a WebGLTexture) whenever a
// new entry would exceed it.
//
// Relies on Map's insertion-order iteration: re-inserting a key on `get`/`set`
// moves it to the "most recently used" end, so `keys().next().value` is always
// the least-recently-used entry.
export class LRUCache<K, V> {
  private map = new Map<K, V>();

  constructor(private maxSize: number, private onEvict?: (key: K, value: V) => void) {}

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v); // move to MRU end
    return v;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value as K;
      const oldestVal = this.map.get(oldestKey) as V;
      this.map.delete(oldestKey);
      try { this.onEvict?.(oldestKey, oldestVal); } catch { /* eviction must never throw into a draw call */ }
    }
  }

  get size(): number {
    return this.map.size;
  }
}
