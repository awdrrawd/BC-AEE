import type {WardrobeSlotMeta} from './types';

export const SPS_MAX_SLOTS = 984;
export const SPS_MANIFEST_KEY = 'liko-aee:wardrobe/v2/index';
const RECORD_PREFIX = 'liko-aee:wardrobe/v2/slot/';
export interface SpsSlot {outfit: ItemBundle[]; name: string; meta: WardrobeSlotMeta}
interface Manifest {version: 2; revision: string; capacity: number; slots: Record<string, string>}
export interface SpsWardrobeIO {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  list(): Promise<string[]>;
  check(): void;
}
export const emptySpsSlot = (): SpsSlot => ({outfit: [], name: '', meta: {favorite: false, tags: []}});

/** Capacity never shrinks during a session; sparse saved slots remain addressable. */
export function spsCapacity(occupied: number, highest = -1, previous = 100): number {
  if (highest >= SPS_MAX_SLOTS) throw new Error('sps_legacy_overflow');
  return Math.min(SPS_MAX_SLOTS, Math.max(previous, 100,
    100 * (1 + Math.floor((occupied + 10) / 100)), 100 * Math.ceil((highest + 1) / 100)));
}
function slot(value: unknown): SpsSlot {
  const data = value as SpsSlot;
  if (!data || !Array.isArray(data.outfit) || !data.outfit.every(entry => entry
    && typeof entry.Group === 'string' && typeof entry.Name === 'string')
    || typeof data.name !== 'string' || !data.meta || typeof data.meta.favorite !== 'boolean'
    || !Array.isArray(data.meta.tags) || !data.meta.tags.every(tag => typeof tag === 'string')) {
    throw new Error('sps_invalid_slot');
  }
  return data;
}
function manifest(text: string): Manifest {
  const data = JSON.parse(text) as Manifest;
  if (data.version !== 2 || typeof data.revision !== 'string' || !Number.isInteger(data.capacity)
    || data.capacity < 100 || data.capacity > SPS_MAX_SLOTS
    || (data.capacity !== SPS_MAX_SLOTS && data.capacity % 100 !== 0)
    || !data.slots || typeof data.slots !== 'object' || Array.isArray(data.slots)) throw new Error('sps_invalid_index');
  for (const [index, key] of Object.entries(data.slots)) {
    if (!/^(0|[1-9]\d*)$/.test(index) || Number(index) >= data.capacity
      || typeof key !== 'string' || !key.startsWith(`${RECORD_PREFIX}${index}/`)) throw new Error('sps_invalid_index');
  }
  return data;
}

/** Immutable per-slot records become visible together through one index write.
 * Old chunks and unreferenced records are retained; no destructive migration.
 * This is not a server-side compare-and-swap: truly concurrent devices require service support.
 */
export class SpsWardrobe {
  rows: SpsSlot[] = Array.from({length: 100}, emptySpsSlot);
  ready = false;
  private saving = false;
  private index: Manifest | null = null;
  private indexText: string | null = null;
  constructor(private readonly io: SpsWardrobeIO) {}
  private async read(key: string) { this.io.check(); const value = await this.io.read(key); this.io.check(); return value; }
  private async write(key: string, value: string) { this.io.check(); await this.io.write(key, value); this.io.check(); }
  async load() {
    this.ready = false;
    const raw = await this.read(SPS_MANIFEST_KEY);
    const rows: SpsSlot[] = [];
    if (raw !== null) {
      const data = manifest(raw);
      rows.push(...Array.from({length: data.capacity}, emptySpsSlot));
      // Bounded requests: do not fan out hundreds of authenticated reads.
      const entries = Object.entries(data.slots);
      for (let offset = 0; offset < entries.length; offset += 6) {
        await Promise.all(entries.slice(offset, offset + 6).map(async ([index, key]) => {
          const value = await this.read(key);
          if (value === null) throw new Error('sps_missing_slot');
          rows[Number(index)] = slot(JSON.parse(value));
        }));
      }
      this.index = data;
    } else {
      const keys = await this.io.list(); this.io.check();
      const chunks = keys.filter(key => /^liko-aee:wardon\/[1-9]\d*$/.test(key));
      for (const key of chunks) {
        const rawChunk = await this.read(key);
        if (rawChunk === null) throw new Error('sps_missing_legacy_chunk');
        const data = JSON.parse(rawChunk) as {version: number; outfits: unknown[]; names: unknown[]};
        if (data.version !== 1 || !Array.isArray(data.outfits) || !Array.isArray(data.names)
          || data.outfits.length > 300 || data.names.length > 300) throw new Error('sps_invalid_legacy_chunk');
        const base = (Number(key.split('/').at(-1)) - 1) * 300;
        for (let i = 0; i < Math.max(data.outfits.length, data.names.length); i++) {
          const row = slot({outfit: data.outfits[i] ?? [], name: data.names[i] ?? '', meta: {favorite: false, tags: []}});
          if (!row.outfit.length && !row.name) continue;
          if (base + i >= SPS_MAX_SLOTS) throw new Error('sps_legacy_overflow');
          rows[base + i] = row;
        }
      }
      this.index = null;
    }
    const capacity = spsCapacity(rows.filter(row => row?.outfit.length).length, rows.length - 1);
    this.rows = Array.from({length: capacity}, (_, i) => rows[i] ?? emptySpsSlot());
    this.indexText = raw;
    this.ready = true;
  }
  async save(indices: readonly number[]) {
    if (this.saving) throw new Error('sps_busy');
    this.saving = true;
    try { await this.commit(indices); } finally { this.saving = false; }
  }
  private async commit(indices: readonly number[]) {
    if (!this.ready) throw new Error('sps_not_ready');
    // Reject an already changed remote index before uploading anything.
    if (await this.read(SPS_MANIFEST_KEY) !== this.indexText) throw new Error('sps_remote_changed');
    const revision = crypto.randomUUID();
    const next: Manifest = {version: 2, revision, capacity: this.rows.length, slots: {...this.index?.slots}};
    // First save copies all valid legacy rows, retaining the original chunks as backup.
    const changed = this.index ? [...new Set(indices)] : this.rows.map((_, i) => i);
    const snapshot = structuredClone(this.rows);
    for (const index of changed) {
      if (!Number.isInteger(index) || index < 0 || index >= snapshot.length) throw new Error('sps_invalid_slot_index');
      const row = slot(snapshot[index]);
      if (!row.outfit.length && !row.name && !row.meta.favorite && !row.meta.tags.length) {
        delete next.slots[index]; continue;
      }
      const key = `${RECORD_PREFIX}${index}/${revision}`;
      await this.write(key, JSON.stringify(row));
      next.slots[index] = key;
    }
    if (await this.read(SPS_MANIFEST_KEY) !== this.indexText) throw new Error('sps_remote_changed');
    next.capacity = spsCapacity(snapshot.filter(row => row.outfit.length).length, -1, this.rows.length);
    const text = JSON.stringify(next);
    try { await this.write(SPS_MANIFEST_KEY, text); }
    catch (error) {
      // A lost response does not prove the server rejected the commit.
      if (await this.read(SPS_MANIFEST_KEY) !== text) throw error;
    }
    if (await this.read(SPS_MANIFEST_KEY) !== text) throw new Error('sps_remote_changed');
    this.index = next; this.indexText = text;
    while (this.rows.length < next.capacity) this.rows.push(emptySpsSlot());
  }
}
