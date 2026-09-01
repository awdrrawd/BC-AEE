import {settings} from '@/core/settings';
import type {WardrobeSlotMeta, WardrobeSourceId} from '@/core/types';
import {bumpWardrobeData, getWardrobeState} from '@/core/wardrobeStore';
import {type LocalWardrobeRecord, readLocalWardrobeRecord, writeLocalWardrobeRecord} from '@/core/wardrobeDb';
import {listSpsKeys, readSpsText, SPS_WARDROBE_PREFIX, writeSpsText} from '@/core/sps';
import {showToast} from '@/util/toast';
import {t} from '@/i18n/i18n';
import {imageFileToWebp, readBackgroundBlob, writeBackgroundBlob} from '@/core/backgroundImageStore';

const DEFAULT_WARDROBE_SIZE = 24;
const EXPANDED_WARDROBE_SIZE = 96;
const LOCAL_WARDROBE_SIZE = 288;
const SPS_WARDROBE_CHUNK_SIZE = 300;

const CUSTOM_BG_KEY = 'liko-aee-wardrobe-bg';
const CUSTOM_BG_ID = 'wardrobe';
const LOCAL_WARDROBE_PREFIX = 'liko-aee-wardrobe-local:';
const LEGACY_ONLINE_BACKUP_PREFIX = 'liko-aee-wardrobe-backup:';

// Shared expanded-wardrobe key: WCE and LCE both store their 24→96 extension here (LZString+JSON),
// so pointing AEE at the same key makes all three read/write one 96-slot online wardrobe.
const FBC_WARDROBE_KEY = 'FBCWardrobe';
// AEE's own pre-split extension key, kept only to migrate legacy data into FBCWardrobe.
const LEGACY_EXTENSION_WARDROBE_KEY = 'LIKO_AEE_WARDROBE';

export const CUSTOM_BG_PATH = 'custom';

// The server limits the serialized AccountUpdate payload: UTF-8 bytes on the
// wire, not JavaScript UTF-16 code units. FBCWardrobe is compressToUTF16 data,
// so `.length` can under-report its upload size by almost 3x.
const ACCOUNT_UPDATE_BYTE_LIMIT = 180000;

function extensionSettings(): Record<string, unknown> | undefined {
  return Player?.ExtensionSettings as Record<string, unknown> | undefined;
}

/** True when a shared extended wardrobe (WCE/LCE, or a prior AEE session) already exists. */
function externalExtendedActive(): boolean {
  const raw = extensionSettings()?.[FBC_WARDROBE_KEY];
  return typeof raw === 'string' && raw.length > 0;
}

/**
 * The online wardrobe is a single 96-slot wardrobe (slots 24–96 shared via FBCWardrobe).
 * It expands to 96 when the user enables it *or* when WCE/LCE already did — matching whatever
 * those mods show, rather than stacking a second 96-slot segment on top (the old 96+96 bug).
 */
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
  /** Pushes the given slots to the underlying storage. False = storage full/unavailable, callers roll back. */
  persist(indices: readonly number[]): boolean;
  reload(): void;
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

// ---------------------------------------------------------------------------
// Online wardrobe: one 96-slot wardrobe living entirely in Player.Wardrobe.
// Slots 0–24 sync to the server (base BC wardrobe); slots 24–96 are the shared
// expansion persisted to Player.ExtensionSettings.FBCWardrobe (WCE/LCE format).
// ---------------------------------------------------------------------------

/** Legacy AEE extension payload (pre-split), read only during migration. */
interface StoredExtensionWardrobe {
  v: 1;
  /** Compressed via CharacterCompressWardrobe. */
  w: string;
  n: string[];
}

/** Compressed payload that would be written to FBCWardrobe for the current extended slots (24–96). */
function compressedExtendedWardrobe(): string {
  const extended = (Player?.Wardrobe ?? [])
    .slice(DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE)
    .map(outfit => (Array.isArray(outfit) ? outfit : []));
  return LZString.compressToUTF16(JSON.stringify(extended));
}

function extensionSettingUploadBytes(fbcWardrobe: string): number {
  // ServerPlayerExtensionSettingsSync only sends this dot-notation key. Other
  // plugins' ExtensionSettings do not share this request or consume AEE's limit.
  const path = `ExtensionSettings.${FBC_WARDROBE_KEY}`;
  return new TextEncoder().encode(JSON.stringify({[path]: fbcWardrobe})).byteLength;
}

/** Actual UTF-8 upload size of AEE's FBCWardrobe key against BC's AccountUpdate limit. */
export function fbcWardrobeUsage(): {used: number; budget: number} {
  return {used: extensionSettingUploadBytes(compressedExtendedWardrobe()), budget: ACCOUNT_UPDATE_BYTE_LIMIT};
}

/** Serializes the extended slots (24–96) into the shared FBCWardrobe extension setting. */
function writeFbcWardrobe(): boolean {
  if (!Player.Wardrobe) return false;
  try {
    const payload = compressedExtendedWardrobe();
    // Over BC's AccountUpdate cap: reject before writing so the caller rolls back and warns,
    // rather than letting the oversized sync throw later at flush time.
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

/** Loads the shared FBCWardrobe expansion into Player.Wardrobe[24..96], filling only empty slots. */
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

  // Extended slots (24–96) go to the shared FBCWardrobe extension.
  if (needsExtended && !writeFbcWardrobe()) return false;

  // Base slots (0–24) plus names for the whole visible range sync to the server.
  // With WCE/LCE loaded, CharacterCompressWardrobe is hooked to route the tail into FBCWardrobe;
  // slicing to the base size here keeps that path a no-op and avoids a double write.
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
};

interface StoredLocalWardrobe {
  version: 1 | 2;
  outfits: unknown[];
  names: unknown[];
}

// In-memory cache: the WardrobeSource API is synchronous, so reads come from here while
// IndexedDB is read/written asynchronously behind it.
const localOutfits: ItemBundle[][] = Array.from({length: LOCAL_WARDROBE_SIZE}, () => []);
const localNames: string[] = Array.from({length: LOCAL_WARDROBE_SIZE}, () => '');
// Guards against a slow load for an old scope overwriting the cache after the scope changed.
let localLoadToken = 0;

function localWardrobeKey(): string {
  return LOCAL_WARDROBE_PREFIX + storageScope();
}

/** Legacy localStorage payload, kept only to migrate old data into IndexedDB. */
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
  // Fire-and-forget: IndexedDB has ample quota, so we optimistically report success and
  // only surface a problem in the console if the write later fails.
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

  // One-time migration: pull any pre-IndexedDB localStorage data across, then drop it.
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

  // A newer load (e.g. after a scope switch) already superseded this one.
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
};

// SPS is asynchronous, while the wardrobe UI deliberately consumes a synchronous source.
// Keep a memory mirror and refresh it when the source is opened; writes upload a complete,
// versioned snapshot so a failed request never corrupts the currently visible wardrobe.
const spsOutfits: ItemBundle[][] = Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => []);
const spsNames: string[] = Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => '');
let spsLoadToken = 0;

interface StoredSpsWardrobe {
  version: 1;
  outfits: unknown[];
  names: unknown[];
}

async function loadSpsWardrobe() {
  const token = ++spsLoadToken;
  try {
    const keys = await listSpsKeys();
    const chunks = keys
      .filter(key => key.startsWith(SPS_WARDROBE_PREFIX))
      .map(key => Number(key.slice(SPS_WARDROBE_PREFIX.length)))
      .filter(index => Number.isInteger(index) && index > 0)
      .sort((a, b) => a - b);
    const chunkCount = Math.max(1, chunks.at(-1) ?? 1);
    const texts = await Promise.all(Array.from({length: chunkCount}, (_, index) =>
      readSpsText(`${SPS_WARDROBE_PREFIX}${index + 1}`)));
    if (token !== spsLoadToken) return;
    resetSpsArrays(chunkCount * SPS_WARDROBE_CHUNK_SIZE);
    texts.forEach((text, index) => {
      if (text === null) return;
      const parsed = JSON.parse(text) as Partial<StoredSpsWardrobe>;
      fillSpsChunk(index, Array.isArray(parsed.outfits) ? parsed.outfits : [], Array.isArray(parsed.names) ? parsed.names : []);
    });
    growSpsIfFull();
    bumpWardrobeData();
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to load the SPS wardrobe', error);
    showToast(t('wardrobe-toast-sps-load-failed'), {color: '#f87171'});
  }
}

function resetSpsArrays(size: number) {
  spsOutfits.length = size;
  spsNames.length = size;
  for (let index = 0; index < size; index++) {
    spsOutfits[index] = [];
    spsNames[index] = '';
  }
}

function fillSpsChunk(chunk: number, outfits: readonly unknown[], names: readonly unknown[]) {
  const offset = chunk * SPS_WARDROBE_CHUNK_SIZE;
  for (let local = 0; local < SPS_WARDROBE_CHUNK_SIZE; local++) {
    const outfit = outfits[local];
    spsOutfits[offset + local] = Array.isArray(outfit) && outfit.every(isBundleEntry) ? outfit as ItemBundle[] : [];
    spsNames[offset + local] = typeof names[local] === 'string' ? names[local] as string : '';
  }
}

function growSpsIfFull() {
  const lastChunkStart = spsOutfits.length - SPS_WARDROBE_CHUNK_SIZE;
  if (spsOutfits.slice(lastChunkStart).every(outfit => outfit.length > 0)) {
    spsOutfits.push(...Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => []));
    spsNames.push(...Array.from({length: SPS_WARDROBE_CHUNK_SIZE}, () => ''));
  }
}

function persistSps(indices: readonly number[]): boolean {
  const chunks = [...new Set(indices.map(index => Math.floor(index / SPS_WARDROBE_CHUNK_SIZE)))];
  const uploads = chunks.map(chunk => {
    const start = chunk * SPS_WARDROBE_CHUNK_SIZE;
    const payload = JSON.stringify({
      version: 1,
      outfits: spsOutfits.slice(start, start + SPS_WARDROBE_CHUNK_SIZE),
      names: spsNames.slice(start, start + SPS_WARDROBE_CHUNK_SIZE),
    } satisfies StoredSpsWardrobe);
    return writeSpsText(`${SPS_WARDROBE_PREFIX}${chunk + 1}`, payload);
  });
  void Promise.all(uploads)
    .then(() => { bumpWardrobeData(); showToast(t('wardrobe-toast-sps-synced')); })
    .catch(error => {
      console.warn('🐈‍⬛ [AEE] Failed to save the SPS wardrobe', error);
      showToast(t('wardrobe-toast-sps-save-failed'), {color: '#f87171'});
    });
  return true;
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
  reload() { void loadSpsWardrobe(); },
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
  if (settings.wardrobeSpsEnabled.get()) spsSource.reload();
}

/**
 * One-time move of AEE's old separate extension wardrobe (LIKO_AEE_WARDROBE, the segment that
 * used to stack on top as slots 96+) into empty slots of the shared 96-slot wardrobe, so users
 * don't lose those outfits when the extra segment is dropped. Best-effort: anything that doesn't
 * fit stays untouched in the old key as a backup.
 */
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

// ---------------------------------------------------------------------------
// Slot metadata (favorites / tags)
// ---------------------------------------------------------------------------

function slotMetaKey(source: WardrobeSourceId, index: number): string {
  // Online outfits live at fixed Player.Wardrobe indices now, so meta keys by absolute index.
  // The `b` prefix is retained so existing keys (from the previous 96-slot base) still match.
  if (source === 'online') return `online:${accountScope()}:b${index}`;
  return `local:${storageScope()}:${index}`;
}

export function getSlotMeta(source: WardrobeSourceId, index: number): WardrobeSlotMeta {
  const meta = settings.wardrobeSlotMeta.get()[slotMetaKey(source, index)];
  return {favorite: !!meta?.favorite, tags: meta?.tags ?? []};
}

export function setSlotMeta(source: WardrobeSourceId, index: number, patch: Partial<WardrobeSlotMeta>) {
  settings.wardrobeSlotMeta.set({
    ...settings.wardrobeSlotMeta.get(),
    [slotMetaKey(source, index)]: {...getSlotMeta(source, index), ...patch},
  });
}

/** One-time rewrite of pre-split meta keys (`<scope>:<index>`) to source-prefixed keys. */
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

// ---------------------------------------------------------------------------
// Custom background
// ---------------------------------------------------------------------------

let customBackgroundObjectUrl: string | null = null;
let customBackgroundLoading: Promise<void> | null = null;

function setCustomBackgroundBlob(blob: Blob) {
  if (customBackgroundObjectUrl) URL.revokeObjectURL(customBackgroundObjectUrl);
  customBackgroundObjectUrl = URL.createObjectURL(blob);
  bumpWardrobeData();
}

async function loadCustomBackground() {
  let blob = await readBackgroundBlob(CUSTOM_BG_ID).catch(() => null);
  if (!blob) {
    // One-time migration from the old localStorage data URL representation.
    let legacy: string | null = null;
    try { legacy = localStorage.getItem(CUSTOM_BG_KEY); } catch { /* unavailable */ }
    if (legacy) {
      const source = await fetch(legacy).then(response => response.blob());
      blob = await imageFileToWebp(new File([source], 'wardrobe-background', {type: source.type}), 0.95);
      await writeBackgroundBlob(CUSTOM_BG_ID, blob);
      try { localStorage.removeItem(CUSTOM_BG_KEY); } catch { /* unavailable */ }
    }
  }
  if (blob) setCustomBackgroundBlob(blob);
}

export function readCustomBackground(): string | null {
  if (!customBackgroundObjectUrl && !customBackgroundLoading) {
    customBackgroundLoading = loadCustomBackground()
      .catch(error => console.warn('🐈‍⬛ [AEE] Failed to load the custom wardrobe background', error))
      .finally(() => { customBackgroundLoading = null; });
  }
  return customBackgroundObjectUrl;
}

export async function writeCustomBackground(file: File): Promise<boolean> {
  try {
    const blob = await imageFileToWebp(file, 0.95);
    await writeBackgroundBlob(CUSTOM_BG_ID, blob);
    setCustomBackgroundBlob(blob);
    try { localStorage.removeItem(CUSTOM_BG_KEY); } catch { /* unavailable */ }
    return true;
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to store the custom wardrobe background', error);
    return false;
  }
}
