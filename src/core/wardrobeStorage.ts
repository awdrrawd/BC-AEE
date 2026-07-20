import {settings} from '@/core/settings';
import type {WardrobeSlotMeta, WardrobeSourceId} from '@/core/types';
import {bumpWardrobeData, getWardrobeState} from '@/core/wardrobeStore';
import {type LocalWardrobeRecord, readLocalWardrobeRecord, writeLocalWardrobeRecord} from '@/core/wardrobeDb';

const DEFAULT_WARDROBE_SIZE = 24;
const EXPANDED_WARDROBE_SIZE = 96;
const LOCAL_WARDROBE_SIZE = 288;

const CUSTOM_BG_KEY = 'liko-aee-wardrobe-bg';
const LOCAL_WARDROBE_PREFIX = 'liko-aee-wardrobe-local:';
const LEGACY_ONLINE_BACKUP_PREFIX = 'liko-aee-wardrobe-backup:';

// Shared expanded-wardrobe key: WCE and LCE both store their 24→96 extension here (LZString+JSON),
// so pointing AEE at the same key makes all three read/write one 96-slot online wardrobe.
const FBC_WARDROBE_KEY = 'FBCWardrobe';
// AEE's own pre-split extension key, kept only to migrate legacy data into FBCWardrobe.
const LEGACY_EXTENSION_WARDROBE_KEY = 'LIKO_AEE_WARDROBE';

export const CUSTOM_BG_PATH = 'custom';

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

/** Serializes the extended slots (24–96) into the shared FBCWardrobe extension setting. */
function writeFbcWardrobe(): boolean {
  if (!Player.Wardrobe) return false;
  const extended = Player.Wardrobe
    .slice(DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE)
    .map(outfit => (Array.isArray(outfit) ? outfit : []));
  try {
    Player.ExtensionSettings ??= {};
    (Player.ExtensionSettings as Record<string, unknown>)[FBC_WARDROBE_KEY] =
      LZString.compressToUTF16(JSON.stringify(extended));
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

export function wardrobeSourceById(id: WardrobeSourceId): WardrobeSource {
  return id === 'online' ? onlineSource : localSource;
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
