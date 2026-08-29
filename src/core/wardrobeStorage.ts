import {settings} from '@/core/settings';
import type {WardrobeSlotMeta, WardrobeSourceId} from '@/core/types';
import {bumpWardrobeData, getWardrobeState, setWardrobeState} from '@/core/wardrobeStore';
import {type LocalWardrobeRecord, readLocalWardrobeRecord, writeLocalWardrobeRecord} from '@/core/wardrobeDb';
import {deleteSpsKey, listSpsKeys, readSpsText, SPS_WARDROBE_PREFIX, writeSpsText} from '@/core/sps';
import {showToast} from '@/util/toast';
import {t} from '@/i18n/i18n';

const DEFAULT_WARDROBE_SIZE = 24;
const EXPANDED_WARDROBE_SIZE = 96;
const LOCAL_WARDROBE_SIZE = 288;
const SPS_WARDROBE_CHUNK_SIZE = 300;
const SPS_WARDROBE_MAX_CHUNKS = 16;
const SPS_WARDROBE_MAX_SLOTS = SPS_WARDROBE_CHUNK_SIZE * SPS_WARDROBE_MAX_CHUNKS;
const SPS_WARDROBE_SLOT_PREFIX = 'liko-aee:wardrobe/slot/';
const SPS_WARDROBE_TXN_KEY = 'liko-aee:wardrobe/transaction';

const CUSTOM_BG_KEY = 'liko-aee-wardrobe-bg';
const LOCAL_WARDROBE_PREFIX = 'liko-aee-wardrobe-local:';
const LEGACY_ONLINE_BACKUP_PREFIX = 'liko-aee-wardrobe-backup:';

const FBC_WARDROBE_KEY = 'FBCWardrobe';
const LEGACY_EXTENSION_WARDROBE_KEY = 'LIKO_AEE_WARDROBE';

export const CUSTOM_BG_PATH = 'custom';

const ACCOUNT_UPDATE_BYTE_LIMIT = 180000;

function extensionSettings(): Record<string, unknown> | undefined {
  return Player?.ExtensionSettings as Record<string, unknown> | undefined;
}

function externalExtendedActive(): boolean {
  const raw = extensionSettings()?.[FBC_WARDROBE_KEY];
  return typeof raw === 'string' && raw.length > 0;
}

export function onlineWardrobeSize(): number {
  return settings.wardrobeExtended.get() || externalExtendedActive() ? EXPANDED_WARDROBE_SIZE : DEFAULT_WARDROBE_SIZE;
}

function accountScope(): string {
  const memberNumber = Player?.MemberNumber ?? 'unknown';
  return `acct-${memberNumber}`;
}

export function storageScope(): string {
  return settings.wardrobeShared.get() ? 'shared' : accountScope();
}

export interface WardrobeSource {
  readonly id: WardrobeSourceId;
  size(): number;
  outfitAt(index: number): ItemBundle[];
  nameAt(index: number): string;
  writeSlot(index: number, outfit: ItemBundle[], name: string): void;
  swap(a: number, b: number): void;
  persist(indices: readonly number[]): boolean | Promise<boolean>;
  reload(): void | Promise<void>;
  isReady(): boolean;
}

function isBundleEntry(value: unknown): value is ItemBundle {
  const entry = value as ItemBundle | null;
  return !!entry && typeof entry === 'object' && typeof entry.Group === 'string' && typeof entry.Name === 'string';
}

function swapSlots(source: WardrobeSource, a: number, b: number) {
  const outfit = source.outfitAt(a);
  const name = source.nameAt(a);
  source.writeSlot(a, source.outfitAt(b), source.nameAt(b));
  source.writeSlot(b, outfit, name);
}

interface StoredExtensionWardrobe {
  v: 1;
  /** Compressed via CharacterCompressWardrobe. */
  w: string;
  n: string[];
}

function compressedExtendedWardrobe(): string {
  const extended = (Player?.Wardrobe ?? [])
    .slice(DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE)
    .map(outfit => (Array.isArray(outfit) ? outfit : []));
  return LZString.compressToUTF16(JSON.stringify(extended));
}

function extensionSettingUploadBytes(fbcWardrobe: string): number {
  const path = `ExtensionSettings.${FBC_WARDROBE_KEY}`;
  return new TextEncoder().encode(JSON.stringify({[path]: fbcWardrobe})).byteLength;
}

export function fbcWardrobeUsage(): {used: number; budget: number} {
  return {used: extensionSettingUploadBytes(compressedExtendedWardrobe()), budget: ACCOUNT_UPDATE_BYTE_LIMIT};
}

function writeFbcWardrobe(): boolean {
  if (!Player.Wardrobe) return false;
  try {
    const payload = compressedExtendedWardrobe();
    if (extensionSettingUploadBytes(payload) > ACCOUNT_UPDATE_BYTE_LIMIT) return false;
    Player.ExtensionSettings ??= {};
    (Player.ExtensionSettings as Record<string, unknown>)[FBC_WARDROBE_KEY] = payload;
    ServerPlayerExtensionSettingsSync(FBC_WARDROBE_KEY);
    return true;
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to store the extended wardrobe', error);
    return false;
  }
}

function loadFbcWardrobe() {
  const raw = extensionSettings()?.[FBC_WARDROBE_KEY];
  if (typeof raw !== 'string' || !raw || !Player.Wardrobe) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(LZString.decompressFromUTF16(raw) || 'null');
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to decompress the extended wardrobe', error);
    return;
  }
  if (!Array.isArray(parsed)) return;

  for (let index = DEFAULT_WARDROBE_SIZE; index < EXPANDED_WARDROBE_SIZE; index++) {
    const existing = Player.Wardrobe[index];
    if (existing && existing.length > 0) continue; // WCE/LCE may have loaded it already — don't clobber
    const outfit = parsed[index - DEFAULT_WARDROBE_SIZE];
    if (Array.isArray(outfit) && outfit.every(isBundleEntry)) Player.Wardrobe[index] = outfit;
  }
}

function persistOnline(indices: readonly number[]): boolean {
  if (!Player.Wardrobe) return false;
  const needsExtended = indices.some(index => index >= DEFAULT_WARDROBE_SIZE);

  if (needsExtended && !writeFbcWardrobe()) return false;

  ServerAccountUpdate.QueueData({
    Wardrobe: CharacterCompressWardrobe(Player.Wardrobe.slice(0, DEFAULT_WARDROBE_SIZE)),
    WardrobeCharacterNames: (Player.WardrobeCharacterNames ?? []).slice(0, onlineWardrobeSize()),
  });
  return true;
}

const onlineSource: WardrobeSource = {
  id: 'online',
  size: () => onlineWardrobeSize(),
  outfitAt: index => Player.Wardrobe?.[index] ?? [],
  nameAt: index => Player.WardrobeCharacterNames?.[index] ?? '',
  writeSlot(index, outfit, name) {
    if (index < 0 || index >= EXPANDED_WARDROBE_SIZE || !Player.Wardrobe) return;
    Player.Wardrobe[index] = outfit;
    Player.WardrobeCharacterNames ??= [];
    Player.WardrobeCharacterNames[index] = name;
  },
  swap(a, b) {
    swapSlots(this, a, b);
  },
  persist: persistOnline,
  reload: loadFbcWardrobe,
  isReady: () => true,
};

interface StoredLocalWardrobe {
  version: 1 | 2;
  outfits: unknown[];
  names: unknown[];
}

const localOutfits: ItemBundle[][] = Array.from({length: LOCAL_WARDROBE_SIZE}, () => []);
const localNames: string[] = Array.from({length: LOCAL_WARDROBE_SIZE}, () => '');
let localLoadToken = 0;

function localWardrobeKey(): string {
  return LOCAL_WARDROBE_PREFIX + storageScope();
}

function readLegacyLocalWardrobe(): StoredLocalWardrobe | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(localWardrobeKey()) || 'null') as StoredLocalWardrobe | null;
    return parsed && Array.isArray(parsed.outfits) && Array.isArray(parsed.names) ? parsed : null;
  } catch {
    return null;
  }
}

function fillLocalArrays(outfits: readonly unknown[], names: readonly unknown[]) {
  for (let index = 0; index < LOCAL_WARDROBE_SIZE; index++) {
    const outfit = outfits[index];
    localOutfits[index] = Array.isArray(outfit) && outfit.every(isBundleEntry) ? (outfit as ItemBundle[]) : [];
    const name = names[index];
    localNames[index] = typeof name === 'string' ? name : '';
  }
}

function persistLocal(): boolean {
  const record: LocalWardrobeRecord = {
    scope: storageScope(),
    outfits: localOutfits.map(outfit => outfit ?? []),
    names: [...localNames],
  };
  writeLocalWardrobeRecord(record).catch(error => {
    console.warn('🐈‍⬛ [AEE] Failed to store the local wardrobe', error);
  });
  return true;
}

function reloadLocalWardrobe() {
  void loadLocalWardrobe();
}

async function loadLocalWardrobe() {
  const scope = storageScope();
  const token = ++localLoadToken;

  let record: LocalWardrobeRecord | null = null;
  try {
    record = await readLocalWardrobeRecord(scope);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to read the local wardrobe', error);
  }

  if (!record) {
    const legacy = readLegacyLocalWardrobe();
    if (legacy) {
      record = {scope, outfits: legacy.outfits as ItemBundle[][], names: legacy.names as string[]};
      try {
        await writeLocalWardrobeRecord(record);
        localStorage.removeItem(localWardrobeKey());
      } catch (error) {
        console.warn('🐈‍⬛ [AEE] Failed to migrate the local wardrobe to IndexedDB', error);
      }
    }
  }

  if (token !== localLoadToken) return;

  fillLocalArrays(record?.outfits ?? [], record?.names ?? []);
  bumpWardrobeData();
}

const localSource: WardrobeSource = {
  id: 'local',
  size: () => LOCAL_WARDROBE_SIZE,
  outfitAt: index => localOutfits[index] ?? [],
  nameAt: index => localNames[index] ?? '',
  writeSlot(index, outfit, name) {
    if (index < 0 || index >= LOCAL_WARDROBE_SIZE) return;
    localOutfits[index] = outfit;
    localNames[index] = name;
  },
  swap(a, b) {
    swapSlots(this, a, b);
  },
  persist: persistLocal,
  reload: reloadLocalWardrobe,
  isReady: () => true,
};

const spsOutfits: ItemBundle[][] = Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => []);
const spsNames: string[] = Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => '');
const spsMeta: WardrobeSlotMeta[] = Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => ({favorite: false, tags: []}));
const spsLegacyOccupied = new Set<number>();
const spsLegacyMigrationCandidates = new Set<number>();
let spsLoadToken = 0;
let spsReady = false;
let spsLoadPromise: Promise<void> | null = null;
let spsWriteQueue: Promise<void> = Promise.resolve();

interface StoredLegacySpsWardrobe {
  version: 1;
  outfits: unknown[];
  names: unknown[];
}

interface StoredSpsSlot {
  version: 2;
  outfit: unknown[];
  name: string;
  meta: WardrobeSlotMeta;
}

interface StoredSpsTransaction {
  version: 1;
  records: ReadonlyArray<{index: number; value: StoredSpsSlot | null}>;
}

function emptySlotMeta(): WardrobeSlotMeta {
  return {favorite: false, tags: []};
}

function normalizeSlotMeta(value: unknown): WardrobeSlotMeta {
  const meta = value as Partial<WardrobeSlotMeta> | null;
  return {
    favorite: !!meta?.favorite,
    tags: Array.isArray(meta?.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [],
  };
}

function parseSpsIndex(key: string, prefix: string, maxExclusive: number): number | null {
  if (!key.startsWith(prefix)) return null;
  const oneBased = Number(key.slice(prefix.length));
  return Number.isInteger(oneBased) && oneBased > 0 && oneBased <= maxExclusive ? oneBased - 1 : null;
}

function spsSlotKey(index: number): string {
  return `${SPS_WARDROBE_SLOT_PREFIX}${index + 1}`;
}

async function mapWithConcurrency<T, R>(values: readonly T[], limit: number, worker: (value: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  const runners = Array.from({length: Math.min(limit, values.length)}, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= values.length) return;
      result[index] = await worker(values[index]);
    }
  });
  await Promise.all(runners);
  return result;
}

function legacyLocalMeta(index: number): WardrobeSlotMeta {
  const key = `local:${storageScope()}:${index}`;
  return normalizeSlotMeta(settings.wardrobeSlotMeta.get()[key]);
}

async function loadSpsWardrobe() {
  const token = ++spsLoadToken;
  spsReady = false;
  setWardrobeState({spsStatus: 'loading'});
  // Never expose the prior account/load's mirror while authentication and the
  // fresh key list are still pending.
  resetSpsArrays(SPS_WARDROBE_CHUNK_SIZE);
  spsLegacyOccupied.clear();
  spsLegacyMigrationCandidates.clear();
  bumpWardrobeData();
  try {
    await spsWriteQueue;
    const keys = await listSpsKeys();
    const legacyChunks = [...new Set(keys
      .map(key => parseSpsIndex(key, SPS_WARDROBE_PREFIX, SPS_WARDROBE_MAX_CHUNKS))
      .filter((index): index is number => index !== null))]
      .sort((a, b) => a - b);
    const slots = [...new Set(keys
      .map(key => parseSpsIndex(key, SPS_WARDROBE_SLOT_PREFIX, SPS_WARDROBE_MAX_SLOTS))
      .filter((index): index is number => index !== null))]
      .sort((a, b) => a - b);
    const legacyChunkCount = (legacyChunks.at(-1) ?? -1) + 1;
    const highestSlot = slots.at(-1) ?? -1;
    const legacyTexts = await mapWithConcurrency(legacyChunks, 6,
      chunk => readSpsText(`${SPS_WARDROBE_PREFIX}${chunk + 1}`));
    const slotTexts = await mapWithConcurrency(slots, 8, index => readSpsText(spsSlotKey(index)));
    const transactionText = keys.includes(SPS_WARDROBE_TXN_KEY) ? await readSpsText(SPS_WARDROBE_TXN_KEY) : null;
    let transactionRecords: ReadonlyArray<{index: number; value: StoredSpsSlot | null}> = [];
    if (transactionText) {
      const transaction = JSON.parse(transactionText) as Partial<StoredSpsTransaction>;
      if (transaction.version !== 1 || !Array.isArray(transaction.records)) throw new Error('bad_sps_transaction');
      transactionRecords = transaction.records.filter(isStoredSpsTransactionRecord);
      if (transactionRecords.length !== transaction.records.length) throw new Error('bad_sps_transaction_record');
    }
    const highestTransactionSlot = transactionRecords.reduce((highest, record) => Math.max(highest, record.index), -1);
    const size = Math.max(SPS_WARDROBE_CHUNK_SIZE,
      legacyChunkCount * SPS_WARDROBE_CHUNK_SIZE,
      Math.ceil((Math.max(highestSlot, highestTransactionSlot) + 1) / SPS_WARDROBE_CHUNK_SIZE)
        * SPS_WARDROBE_CHUNK_SIZE);
    if (token !== spsLoadToken) return;
    resetSpsArrays(size);
    spsLegacyOccupied.clear();
    spsLegacyMigrationCandidates.clear();
    const validLegacyChunks: number[] = [];
    legacyTexts.forEach((text, position) => {
      if (text === null) return;
      try {
        const parsed = JSON.parse(text) as Partial<StoredLegacySpsWardrobe>;
        fillLegacySpsChunk(legacyChunks[position], Array.isArray(parsed.outfits) ? parsed.outfits : [],
          Array.isArray(parsed.names) ? parsed.names : []);
        validLegacyChunks.push(legacyChunks[position]);
      } catch (error) {
        console.warn('🐈‍⬛ [AEE] Ignoring a malformed legacy SPS wardrobe chunk', error);
      }
    });
    slotTexts.forEach((text, position) => {
      if (text === null) return;
      try {
        if (!applyStoredSpsSlot(slots[position], JSON.parse(text))) throw new Error('bad_sps_slot');
        spsLegacyMigrationCandidates.delete(slots[position]);
      }
      catch (error) { console.warn('🐈‍⬛ [AEE] Ignoring a malformed SPS wardrobe slot', error); }
    });
    if (transactionText) {
      for (const record of transactionRecords) {
        applyStoredSpsSlot(record.index, record.value);
        spsLegacyMigrationCandidates.delete(record.index);
      }
      await writeSpsRecords(transactionRecords, false);
      await deleteSpsKey(SPS_WARDROBE_TXN_KEY);
    }
    growSpsIfFull();
    spsReady = true;
    setWardrobeState({spsStatus: 'ready'});
    bumpWardrobeData();
    void migrateLegacySpsWardrobe(validLegacyChunks, [...spsLegacyMigrationCandidates]);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to load the SPS wardrobe', error);
    setWardrobeState({spsStatus: 'error'});
    showToast(t('wardrobe-toast-sps-load-failed'), {color: '#f87171'});
  }
}

function resetSpsArrays(size: number) {
  spsOutfits.length = size;
  spsNames.length = size;
  spsMeta.length = size;
  for (let index = 0; index < size; index++) {
    spsOutfits[index] = [];
    spsNames[index] = '';
    spsMeta[index] = emptySlotMeta();
  }
}

function fillLegacySpsChunk(chunk: number, outfits: readonly unknown[], names: readonly unknown[]) {
  const offset = chunk * SPS_WARDROBE_CHUNK_SIZE;
  for (let local = 0; local < SPS_WARDROBE_CHUNK_SIZE; local++) {
    const outfit = outfits[local];
    spsOutfits[offset + local] = Array.isArray(outfit) && outfit.every(isBundleEntry) ? outfit as ItemBundle[] : [];
    spsNames[offset + local] = typeof names[local] === 'string' ? names[local] as string : '';
    spsMeta[offset + local] = legacyLocalMeta(offset + local);
    if (spsOutfits[offset + local].length || spsNames[offset + local]) spsLegacyOccupied.add(offset + local);
    if (spsOutfits[offset + local].length || spsNames[offset + local]
      || spsMeta[offset + local].favorite || spsMeta[offset + local].tags.length) {
      spsLegacyMigrationCandidates.add(offset + local);
    }
  }
}

function isStoredSpsSlot(value: unknown): value is StoredSpsSlot {
  if (!value || typeof value !== 'object') return false;
  const stored = value as Partial<StoredSpsSlot>;
  const meta = stored.meta as Partial<WardrobeSlotMeta> | undefined;
  return stored.version === 2
    && Array.isArray(stored.outfit) && stored.outfit.every(isBundleEntry)
    && typeof stored.name === 'string'
    && !!meta && typeof meta.favorite === 'boolean'
    && Array.isArray(meta.tags) && meta.tags.every(tag => typeof tag === 'string');
}

function applyStoredSpsSlot(index: number, value: unknown): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= spsOutfits.length) return false;
  if (value === null) {
    spsOutfits[index] = [];
    spsNames[index] = '';
    spsMeta[index] = emptySlotMeta();
    return true;
  }
  if (!isStoredSpsSlot(value)) return false;
  const stored = value;
  spsOutfits[index] = stored.outfit as ItemBundle[];
  spsNames[index] = stored.name;
  spsMeta[index] = normalizeSlotMeta(stored.meta);
  return true;
}

function growSpsIfFull() {
  if (spsOutfits.length >= SPS_WARDROBE_MAX_SLOTS) return;
  const lastChunkStart = spsOutfits.length - SPS_WARDROBE_CHUNK_SIZE;
  if (spsOutfits.slice(lastChunkStart).every(outfit => outfit.length > 0)) {
    spsOutfits.push(...Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => []));
    spsNames.push(...Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => ''));
    spsMeta.push(...Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, emptySlotMeta));
  }
}

function storedSpsSlotAt(index: number): StoredSpsSlot {
  return {version: 2, outfit: spsOutfits[index] ?? [], name: spsNames[index] ?? '', meta: spsMeta[index] ?? emptySlotMeta()};
}

function isStoredSpsTransactionRecord(value: unknown): value is {index: number; value: StoredSpsSlot | null} {
  if (!value || typeof value !== 'object') return false;
  const record = value as {index?: unknown; value?: unknown};
  return Number.isInteger(record.index) && Number(record.index) >= 0 && Number(record.index) < SPS_WARDROBE_MAX_SLOTS
    && (record.value === null || isStoredSpsSlot(record.value));
}

function recordForIndex(index: number): {index: number; value: StoredSpsSlot | null} {
  const value = storedSpsSlotAt(index);
  const empty = value.outfit.length === 0 && !value.name && !value.meta.favorite && value.meta.tags.length === 0;
  return {index, value: empty && !spsLegacyOccupied.has(index) ? null : value};
}

async function writeSpsRecords(records: readonly {index: number; value: StoredSpsSlot | null}[], journal = true) {
  const durable = journal && records.length > 1;
  if (durable) {
    await writeSpsText(SPS_WARDROBE_TXN_KEY, JSON.stringify({version: 1, records} satisfies StoredSpsTransaction));
  }
  try {
    for (const record of records) {
      if (record.value === null) await deleteSpsKey(spsSlotKey(record.index));
      else await writeSpsText(spsSlotKey(record.index), JSON.stringify(record.value));
    }
  } catch (error) {
    if (durable) {
      console.warn('🐈‍⬛ [AEE] SPS wardrobe operation journaled for retry', error);
      return;
    }
    throw error;
  }
  if (durable) {
    try { await deleteSpsKey(SPS_WARDROBE_TXN_KEY); }
    catch (error) { console.warn('🐈‍⬛ [AEE] SPS wardrobe journal cleanup will retry on next load', error); }
  }
}

async function persistSps(indices: readonly number[]): Promise<boolean> {
  if (!spsReady) return false;
  const unique = [...new Set(indices)].filter(index => index >= 0 && index < spsOutfits.length);
  const records = unique.map(recordForIndex);
  const operation = spsWriteQueue.then(() => writeSpsRecords(records));
  spsWriteQueue = operation.catch(() => {});
  try {
    await operation;
    bumpWardrobeData();
    return true;
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to save the SPS wardrobe', error);
    return false;
  }
}

async function migrateLegacySpsWardrobe(chunks: readonly number[], indices: readonly number[]) {
  if (!chunks.length) return;
  const records = indices.map(recordForIndex);
  const operation = spsWriteQueue.then(async () => {
    for (const record of records) await writeSpsRecords([record]);
    for (const chunk of chunks) await deleteSpsKey(`${SPS_WARDROBE_PREFIX}${chunk + 1}`);
  });
  spsWriteQueue = operation.catch(() => {});
  try { await operation; }
  catch (error) { console.warn('🐈‍⬛ [AEE] Legacy SPS wardrobe migration will retry later', error); }
}

function reloadSpsWardrobe(): Promise<void> {
  if (!spsLoadPromise) {
    spsLoadPromise = loadSpsWardrobe().finally(() => { spsLoadPromise = null; });
  }
  return spsLoadPromise;
}

const spsSource: WardrobeSource = {
  id: 'sps',
  size: () => spsOutfits.length,
  outfitAt: index => spsOutfits[index] ?? [],
  nameAt: index => spsNames[index] ?? '',
  writeSlot(index, outfit, name) {
    if (index < 0 || index >= spsOutfits.length) return;
    spsOutfits[index] = outfit;
    spsNames[index] = name;
    growSpsIfFull();
  },
  swap(a, b) { swapSlots(this, a, b); },
  persist: persistSps,
  reload: reloadSpsWardrobe,
  isReady: () => spsReady,
};

export function wardrobeSourceById(id: WardrobeSourceId): WardrobeSource {
  return id === 'online' ? onlineSource : id === 'sps' ? spsSource : localSource;
}

export function activeWardrobeSource(): WardrobeSource {
  return wardrobeSourceById(getWardrobeState().source);
}

let purgedLegacyBackup = false;

export function reloadWardrobeData() {
  migrateSlotMeta();
  if (!purgedLegacyBackup) {
    purgedLegacyBackup = true;
    try {
      localStorage.removeItem(LEGACY_ONLINE_BACKUP_PREFIX + accountScope());
    } catch {
      // localStorage can be unavailable in private or embedded contexts.
    }
  }
  // Never shrink below what WCE/LCE (or the game) already set — that would truncate their
  // in-memory expansion. AEE's own display size comes from onlineSource.size(), not this global.
  WardrobeSize = Math.max(typeof WardrobeSize === 'number' ? WardrobeSize : 0, onlineWardrobeSize());
  WardrobeFixLength();
  WardrobeLoadCharacterNames();
  onlineSource.reload();
  migrateLegacyExtensionWardrobe();
  localSource.reload();
  if (settings.wardrobeSpsEnabled.get()) void spsSource.reload();
}

function migrateLegacyExtensionWardrobe() {
  if (settings.wardrobeFbcMigrated.get()) return;
  settings.wardrobeFbcMigrated.set(true);

  const raw = extensionSettings()?.[LEGACY_EXTENSION_WARDROBE_KEY] as Partial<StoredExtensionWardrobe> | undefined;
  if (!raw || typeof raw.w !== 'string' || !raw.w || !Player.Wardrobe) return;

  let legacy: ItemBundle[][] = [];
  try {
    legacy = CharacterDecompressWardrobe(raw.w);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to read the legacy extended wardrobe for migration', error);
    return;
  }
  const legacyNames = Array.isArray(raw.n) ? raw.n : [];

  let cursor = DEFAULT_WARDROBE_SIZE;
  let moved = false;
  let overflow = false;
  for (let offset = 0; offset < legacy.length; offset++) {
    const outfit = legacy[offset];
    if (!Array.isArray(outfit) || outfit.length === 0 || !outfit.every(isBundleEntry)) continue;
    while (cursor < EXPANDED_WARDROBE_SIZE && (Player.Wardrobe[cursor]?.length ?? 0) > 0) cursor++;
    if (cursor >= EXPANDED_WARDROBE_SIZE) {
      overflow = true;
      break;
    }
    Player.Wardrobe[cursor] = outfit;
    Player.WardrobeCharacterNames ??= [];
    Player.WardrobeCharacterNames[cursor] = typeof legacyNames[offset] === 'string' ? legacyNames[offset] : '';
    cursor++;
    moved = true;
  }

  if (overflow) {
    console.warn('🐈‍⬛ [AEE] Some legacy extended-wardrobe outfits did not fit into 96 slots; kept in the old key as backup');
  }
  if (moved) {
    writeFbcWardrobe();
    ServerAccountUpdate.QueueData({
      WardrobeCharacterNames: (Player.WardrobeCharacterNames ?? []).slice(0, EXPANDED_WARDROBE_SIZE),
    });
  }
}

function slotMetaKey(source: WardrobeSourceId, index: number): string {
  if (source === 'online') return `online:${accountScope()}:b${index}`;
  if (source === 'sps') return `sps:${accountScope()}:${index}`;
  return `local:${storageScope()}:${index}`;
}

export function getSlotMeta(source: WardrobeSourceId, index: number): WardrobeSlotMeta {
  if (source === 'sps') return spsMeta[index] ?? emptySlotMeta();
  const meta = settings.wardrobeSlotMeta.get()[slotMetaKey(source, index)];
  return {favorite: !!meta?.favorite, tags: meta?.tags ?? []};
}

export function setSlotMeta(source: WardrobeSourceId, index: number, patch: Partial<WardrobeSlotMeta>) {
  if (source === 'sps') {
    if (index >= 0 && index < spsMeta.length) spsMeta[index] = {...getSlotMeta(source, index), ...patch};
    return;
  }
  settings.wardrobeSlotMeta.set({
    ...settings.wardrobeSlotMeta.get(),
    [slotMetaKey(source, index)]: {...getSlotMeta(source, index), ...patch},
  });
}

function migrateSlotMeta() {
  if (settings.wardrobeMetaMigrated.get()) return;

  const meta = settings.wardrobeSlotMeta.get();
  const next: Record<string, WardrobeSlotMeta> = {};
  for (const [key, value] of Object.entries(meta)) {
    const match = /^(acct-\d+|shared):(\d+)$/.exec(key);
    if (!match) {
      next[key] = value;
      continue;
    }
    const scope = match[1];
    const index = Number(match[2]);
    if (scope !== 'shared' && index < EXPANDED_WARDROBE_SIZE) {
      next[`online:${scope}:b${index}`] = value;
    } else if (index >= EXPANDED_WARDROBE_SIZE && index < EXPANDED_WARDROBE_SIZE + LOCAL_WARDROBE_SIZE) {
      next[`local:${scope}:${index - EXPANDED_WARDROBE_SIZE}`] = value;
    }
  }
  settings.wardrobeSlotMeta.set(next);
  settings.wardrobeMetaMigrated.set(true);
}

export function readCustomBackground(): string | null {
  try {
    return localStorage.getItem(CUSTOM_BG_KEY);
  } catch {
    return null;
  }
}

export function writeCustomBackground(dataUrl: string): boolean {
  try {
    localStorage.setItem(CUSTOM_BG_KEY, dataUrl);
    return true;
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to store the custom wardrobe background', error);
    return false;
  }
}
