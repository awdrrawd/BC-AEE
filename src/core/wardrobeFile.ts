import type {PendingImport, WardrobeSlotMeta} from '@/core/types';
import {decodeBundles} from '@/util/appearanceBundle';
import {activeWardrobeSource, getSlotMeta} from '@/core/wardrobeStorage';

const FILE_FORMAT = 'aee-wardrobe';
const FILE_VERSION = 1;

interface WardrobeFileSlot {
  index: number;
  name: string;
  favorite: boolean;
  tags: string[];
  outfit: ItemBundle[];
}

interface WardrobeFile {
  format: typeof FILE_FORMAT;
  version: typeof FILE_VERSION;
  savedAt: string;
  player: string;
  slots: WardrobeFileSlot[];
}

function isBundle(value: unknown): value is ItemBundle {
  const entry = value as Partial<ItemBundle> | null;
  return !!entry && typeof entry === 'object' && typeof entry.Group === 'string' && typeof entry.Name === 'string';
}

function isOutfit(value: unknown): value is ItemBundle[] {
  return Array.isArray(value) && value.length > 0 && value.every(isBundle);
}

export function collectWardrobeSlots(): WardrobeFileSlot[] {
  const source = activeWardrobeSource();
  const slots: WardrobeFileSlot[] = [];
  for (let index = 0; index < source.size(); index++) {
    const outfit = source.outfitAt(index);
    if (!outfit.length) continue;
    const meta = getSlotMeta(source.id, index);
    slots.push({
      index,
      name: source.nameAt(index),
      favorite: meta.favorite,
      tags: meta.tags,
      outfit,
    });
  }
  return slots;
}

export function buildWardrobeFile(slots: WardrobeFileSlot[]): WardrobeFile {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    savedAt: new Date().toISOString(),
    player: Player?.Name ?? '',
    slots,
  };
}

export function wardrobeFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  const player = (Player?.Name ?? 'player').replace(/[^\w-]/g, '') || 'player';
  return `aee-wardrobe-${player}-${date}.json`;
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadJson(fileName: string, json: string) {
  downloadBlob(fileName, new Blob([json], {type: 'application/json'}));
}

export function parseWardrobeFile(text: string): PendingImport[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    /* not JSON: fall through to the code reader */
  }

  const fromFile = parsed && readWardrobeFile(parsed);
  if (fromFile?.length) return fromFile;

  const fromArray = Array.isArray(parsed) ? readOutfitArray(parsed) : null;
  if (fromArray?.length) return fromArray;

  const fromCode = decodeBundles(trimmed);
  return fromCode?.length ? fromCode.map(outfit => ({outfit})) : null;
}

function readWardrobeFile(value: unknown): PendingImport[] | null {
  const file = value as Partial<WardrobeFile> | null;
  if (!file || typeof file !== 'object' || file.format !== FILE_FORMAT || !Array.isArray(file.slots)) return null;

  return file.slots.flatMap((slot: Partial<WardrobeFileSlot> | null): PendingImport[] => {
    if (!slot || !isOutfit(slot.outfit)) return [];
    const meta: WardrobeSlotMeta = {
      favorite: !!slot.favorite,
      tags: Array.isArray(slot.tags) ? slot.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    };
    return [{
      outfit: slot.outfit,
      name: typeof slot.name === 'string' ? slot.name : '',
      meta,
      sourceIndex: typeof slot.index === 'number' && slot.index >= 0 ? slot.index : undefined,
    }];
  });
}

function readOutfitArray(value: unknown[]): PendingImport[] | null {
  const outfits = value.flatMap((entry, index): PendingImport[] =>
    isOutfit(entry) ? [{outfit: entry, sourceIndex: index}] : []);
  return outfits.length ? outfits : null;
}
