import {settings} from '@/core/settings';
import type {WardrobeSlotMeta} from '@/core/types';

const DEFAULT_WARDROBE_SIZE = 24;
const EXPANDED_WARDROBE_SIZE = 96;
const LOCAL_WARDROBE_SIZE = EXPANDED_WARDROBE_SIZE * 4;

const CUSTOM_BG_KEY = 'liko-aee-wardrobe-bg';
const ONLINE_BACKUP_PREFIX = 'liko-aee-wardrobe-backup:';
const LOCAL_WARDROBE_PREFIX = 'liko-aee-wardrobe-local:';

export const CUSTOM_BG_PATH = 'custom';

export function effectiveWardrobeSize(): number {
  if (settings.wardrobeLocal.get() && settings.wardrobeExtended.get()) return LOCAL_WARDROBE_SIZE;
  if (settings.wardrobeExtended.get()) return EXPANDED_WARDROBE_SIZE;
  return DEFAULT_WARDROBE_SIZE;
}

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

interface StoredLocalWardrobe {
  version: 1;
  outfits: unknown[];
  names: unknown[];
}

function localWardrobeKey(): string {
  return LOCAL_WARDROBE_PREFIX + storageScope();
}

function isBundleEntry(value: unknown): value is ItemBundle {
  const entry = value as ItemBundle | null;
  return !!entry && typeof entry === 'object' && typeof entry.Group === 'string' && typeof entry.Name === 'string';
}

function readLocalWardrobe(): StoredLocalWardrobe | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(localWardrobeKey()) || 'null') as StoredLocalWardrobe | null;
    return parsed?.version === 1 && Array.isArray(parsed.outfits) && Array.isArray(parsed.names) ? parsed : null;
  } catch {
    return null;
  }
}

export function hydrateLocalWardrobe() {
  if (effectiveWardrobeSize() <= EXPANDED_WARDROBE_SIZE) return;
  const stored = readLocalWardrobe();
  const localCount = LOCAL_WARDROBE_SIZE - EXPANDED_WARDROBE_SIZE;

  for (let offset = 0; offset < localCount; offset++) {
    const index = EXPANDED_WARDROBE_SIZE + offset;
    const outfit = stored?.outfits[offset];
    const name = stored?.names[offset];
    Player.Wardrobe[index] = Array.isArray(outfit) && outfit.every(isBundleEntry) ? outfit : [];
    Player.WardrobeCharacterNames[index] = typeof name === 'string' ? name : '';
  }
}

export function persistLocalWardrobe(): boolean {
  if (effectiveWardrobeSize() <= EXPANDED_WARDROBE_SIZE) return true;
  try {
    const payload: StoredLocalWardrobe = {
      version: 1,
      outfits: Player.Wardrobe.slice(EXPANDED_WARDROBE_SIZE, LOCAL_WARDROBE_SIZE),
      names: Player.WardrobeCharacterNames.slice(EXPANDED_WARDROBE_SIZE, LOCAL_WARDROBE_SIZE),
    };
    localStorage.setItem(localWardrobeKey(), JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to store the local wardrobe', error);
    return false;
  }
}

export function reloadWardrobeData() {
  WardrobeSize = effectiveWardrobeSize();
  WardrobeFixLength();
  WardrobeLoadCharacterNames();
  hydrateLocalWardrobe();
}

function slotMetaKey(index: number): string {
  const scope = index < EXPANDED_WARDROBE_SIZE ? accountScope() : storageScope();
  return `${scope}:${index}`;
}

export function getSlotMeta(index: number): WardrobeSlotMeta {
  const meta = settings.wardrobeSlotMeta.get()[slotMetaKey(index)];
  return {favorite: !!meta?.favorite, tags: meta?.tags ?? []};
}

export function setSlotMeta(index: number, patch: Partial<WardrobeSlotMeta>) {
  settings.wardrobeSlotMeta.set({
    ...settings.wardrobeSlotMeta.get(),
    [slotMetaKey(index)]: {...getSlotMeta(index), ...patch},
  });
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

export function backupOnlineWardrobe(wardrobe: readonly (ItemBundle[] | null)[]) {
  try {
    const payload = JSON.stringify({
      wardrobe: wardrobe.slice(0, EXPANDED_WARDROBE_SIZE),
      savedAt: Date.now(),
    });
    localStorage.setItem(ONLINE_BACKUP_PREFIX + accountScope(), payload);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to cache the online wardrobe locally', error);
  }
}
