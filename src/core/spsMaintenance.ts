import {SPS_MANIFEST_KEY, SpsWardrobe, isSpsRecordKey, isSpsLegacyKey, parseSpsManifest} from './spsWardrobe';
import type {PendingImport} from './types';

interface MaintenanceIO {
  list(): Promise<string[]>;
  read(key: string): Promise<string | null>;
  check(): void;
}
const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

/** Decode only the archived published wardrobe; never replay historical records or contact SPS. */
export async function recoverSpsArchive(value: unknown): Promise<PendingImport[]> {
  const archive = value as {format?: unknown; version?: unknown; entries?: unknown} | null;
  if (!archive || archive.format !== 'aee-sps-archive' || archive.version !== 1
    || !archive.entries || typeof archive.entries !== 'object' || Array.isArray(archive.entries)) throw new Error('sps_invalid_archive');
  const entries = new Map<string, string>();
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const [key, text] of Object.entries(archive.entries)) {
    if ((key !== SPS_MANIFEST_KEY && !isSpsRecordKey(key) && !isSpsLegacyKey(key))
      || typeof text !== 'string') throw new Error('sps_invalid_archive');
    bytes += encoder.encode(text).byteLength;
    if (bytes > MAX_BACKUP_BYTES) throw new Error('sps_backup_too_large');
    entries.set(key, text);
  }
  if (!entries.has(SPS_MANIFEST_KEY) && ![...entries.keys()].some(key => isSpsLegacyKey(key))) throw new Error('sps_incomplete_archive');
  const wardrobe = new SpsWardrobe({
    read: async key => entries.get(key) ?? null,
    list: async () => [...entries.keys()],
    write: async () => { throw new Error('sps_archive_read_only'); },
    check() {},
  });
  await wardrobe.load();
  return wardrobe.rows.flatMap((row, sourceIndex) => row.outfit.length
    ? [{outfit: row.outfit, name: row.name, meta: row.meta, sourceIndex}] : []);
}

/** Read-only archive. Absence from one index is NOT permission to delete a record:
 * another device may still be preparing its commit, and the service has no CAS.
 */
export async function archiveSpsWardrobe(io: MaintenanceIO, owner: number) {
  io.check();
  const before = await io.read(SPS_MANIFEST_KEY); io.check();
  const index = before === null ? null : parseSpsManifest(before);
  const keys = await io.list(); io.check();
  const selected = [...new Set(keys)].filter(key => key === SPS_MANIFEST_KEY || isSpsRecordKey(key) || isSpsLegacyKey(key));
  if (before !== null && !selected.includes(SPS_MANIFEST_KEY)) throw new Error('sps_incomplete_listing');
  const entries: Record<string, string> = {};
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const key of selected) {
    io.check();
    const value = await io.read(key); io.check();
    if (value === null) throw new Error('sps_archive_changed');
    bytes += encoder.encode(value).byteLength;
    if (bytes > MAX_BACKUP_BYTES) throw new Error('sps_backup_too_large');
    entries[key] = value;
  }
  if (await io.read(SPS_MANIFEST_KEY) !== before) throw new Error('sps_archive_changed');
  io.check();
  if (before !== null && entries[SPS_MANIFEST_KEY] !== before) throw new Error('sps_archive_changed');
  const referenced = new Set<string>();
  if (index !== null) {
    for (const key of Object.values(index.slots)) {
      if (!(key in entries)) throw new Error('sps_incomplete_archive');
      referenced.add(key);
    }
  }
  return {
    format: 'aee-sps-archive', version: 1, owner, createdAt: new Date().toISOString(), bytes,
    // These are observations for review, never a deletion plan.
    notReferencedByObservedIndex: selected.filter(key => isSpsRecordKey(key) && !referenced.has(key)),
    legacyKeys: selected.filter(key => isSpsLegacyKey(key)),
    entries,
  };
}
