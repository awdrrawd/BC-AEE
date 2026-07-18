import {settings} from '@/core/settings';
import type {WardrobeSlotMeta, WardrobeSourceId} from '@/core/types';
import {getWardrobeState} from '@/core/wardrobeStore';

const DEFAULT_WARDROBE_SIZE = 24;
const EXPANDED_WARDROBE_SIZE = 96;
const EXTRA_ONLINE_SIZE = 96;
const LOCAL_WARDROBE_SIZE = 288;

const CUSTOM_BG_KEY = 'liko-aee-wardrobe-bg';
const LOCAL_WARDROBE_PREFIX = 'liko-aee-wardrobe-local:';
const LEGACY_ONLINE_BACKUP_PREFIX = 'liko-aee-wardrobe-backup:';

const EXTENSION_WARDROBE_KEY = 'LIKO_AEE_WARDROBE';
const EXTENSION_SIZE_BUDGET = 150_000;

export const CUSTOM_BG_PATH = 'custom';

export function onlineWardrobeSize(): number {
  return settings.wardrobeExtended.get() ? EXPANDED_WARDROBE_SIZE : DEFAULT_WARDROBE_SIZE;
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
// Online wardrobe: Player.Wardrobe base segment + ExtensionSettings extra segment.
// ---------------------------------------------------------------------------

interface StoredExtensionWardrobe {
  v: 1;
  /** Compressed via CharacterCompressWardrobe. */
  w: string;
  n: string[];
}

const extraOutfits: ItemBundle[][] = [];
const extraNames: string[] = [];

function extraOffset(index: number): number | null {
  const offset = index - onlineWardrobeSize();
  return offset >= 0 && offset < EXTRA_ONLINE_SIZE ? offset : null;
}

function readExtensionWardrobe() {
  extraOutfits.length = 0;
  extraNames.length = 0;

  const raw = Player?.ExtensionSettings?.[EXTENSION_WARDROBE_KEY] as Partial<StoredExtensionWardrobe> | null;
  let outfits: ItemBundle[][] = [];
  if (typeof raw?.w === 'string' && raw.w) {
    try {
      outfits = CharacterDecompressWardrobe(raw.w);
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to decompress the extension wardrobe', error);
    }
  }
  const names = Array.isArray(raw?.n) ? raw.n : [];

  for (let offset = 0; offset < EXTRA_ONLINE_SIZE; offset++) {
    const outfit = outfits[offset];
    extraOutfits.push(Array.isArray(outfit) && outfit.every(isBundleEntry) ? outfit : []);
    const name = names[offset];
    extraNames.push(typeof name === 'string' ? name : '');
  }
}

function persistOnline(indices: readonly number[]): boolean {
  const baseSize = onlineWardrobeSize();
  const needsBase = indices.some(index => index < baseSize);
  const needsExtra = indices.some(index => index >= baseSize);

  let payload: StoredExtensionWardrobe | null = null;
  if (needsExtra) {
    payload = {v: 1, w: CharacterCompressWardrobe(extraOutfits), n: [...extraNames]};
    try {
      const candidate = {...(Player.ExtensionSettings ?? {}), [EXTENSION_WARDROBE_KEY]: payload};
      if (JSON.stringify(candidate).length > EXTENSION_SIZE_BUDGET) return false;
    } catch {
      // Another mod's data failed to serialize — don't block saving over it.
    }
  }

  if (needsBase && Player.Wardrobe) {
    ServerAccountUpdate.QueueData({
      Wardrobe: CharacterCompressWardrobe(Player.Wardrobe.slice(0, baseSize)),
      WardrobeCharacterNames: Player.WardrobeCharacterNames.slice(0, baseSize),
    });
  }
  if (payload) {
    Player.ExtensionSettings ??= {};
    Player.ExtensionSettings[EXTENSION_WARDROBE_KEY] = payload;
    ServerPlayerExtensionSettingsSync(EXTENSION_WARDROBE_KEY);
  }
  return true;
}

const onlineSource: WardrobeSource = {
  id: 'online',
  size: () => onlineWardrobeSize() + EXTRA_ONLINE_SIZE,
  outfitAt(index) {
    const offset = extraOffset(index);
    return offset != null ? extraOutfits[offset] ?? [] : Player.Wardrobe?.[index] ?? [];
  },
  nameAt(index) {
    const offset = extraOffset(index);
    return offset != null ? extraNames[offset] ?? '' : Player.WardrobeCharacterNames?.[index] ?? '';
  },
  writeSlot(index, outfit, name) {
    const offset = extraOffset(index);
    if (offset != null) {
      extraOutfits[offset] = outfit;
      extraNames[offset] = name;
    } else if (Player.Wardrobe) {
      Player.Wardrobe[index] = outfit;
      Player.WardrobeCharacterNames[index] = name;
    }
  },
  swap(a, b) {
    swapSlots(this, a, b);
  },
  persist: persistOnline,
  reload: readExtensionWardrobe,
};

interface StoredLocalWardrobe {
  version: 1 | 2;
  outfits: unknown[];
  names: unknown[];
}

const localOutfits: ItemBundle[][] = [];
const localNames: string[] = [];

function localWardrobeKey(): string {
  return LOCAL_WARDROBE_PREFIX + storageScope();
}

function readRawLocalWardrobe(): StoredLocalWardrobe | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(localWardrobeKey()) || 'null') as StoredLocalWardrobe | null;
    return parsed && Array.isArray(parsed.outfits) && Array.isArray(parsed.names) ? parsed : null;
  } catch {
    return null;
  }
}

function persistLocal(): boolean {
  try {
    const payload = {version: 2 as const, outfits: localOutfits, names: localNames};
    localStorage.setItem(localWardrobeKey(), JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to store the local wardrobe', error);
    return false;
  }
}

function reloadLocalWardrobe() {
  const stored = readRawLocalWardrobe();
  localOutfits.length = 0;
  localNames.length = 0;

  for (let index = 0; index < LOCAL_WARDROBE_SIZE; index++) {
    const outfit = stored?.outfits[index];
    localOutfits.push(Array.isArray(outfit) && outfit.every(isBundleEntry) ? outfit : []);
    const name = stored?.names[index];
    localNames.push(typeof name === 'string' ? name : '');
  }

  // v1 was the Player.Wardrobe tail layout; slot order is unchanged, so just re-save as v2.
  if (stored?.version === 1) persistLocal();
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
  WardrobeSize = onlineWardrobeSize();
  WardrobeFixLength();
  WardrobeLoadCharacterNames();
  onlineSource.reload();
  localSource.reload();
}

// ---------------------------------------------------------------------------
// Slot metadata (favorites / tags)
// ---------------------------------------------------------------------------

function slotMetaKey(source: WardrobeSourceId, index: number): string {
  // Online slots key by segment offset (`b` = Player.Wardrobe base, `e` = ExtensionSettings extra)
  // so toggling the 24/96 base size doesn't reattach meta to the wrong outfit.
  if (source === 'online') {
    const baseSize = onlineWardrobeSize();
    const suffix = index < baseSize ? `b${index}` : `e${index - baseSize}`;
    return `online:${accountScope()}:${suffix}`;
  }
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
