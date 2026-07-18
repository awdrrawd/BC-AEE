import {t} from '@/i18n/i18n';
import type {PendingImport} from '@/core/types';
import {activeWardrobeSource} from '@/core/wardrobeStorage';
import {isSlotOccupied, slotName} from '@/controllers/outfitsController';

export type ImportStatus = 'add' | 'replace' | 'skip';

export interface ImportEntry {
  id: number;
  pending: PendingImport;
  target: number;
  selected: boolean;
}

let serial = 0;

export function planImports(outfits: readonly PendingImport[]): ImportEntry[] {
  const size = activeWardrobeSource().size();
  const taken = new Set<number>();
  let cursor = 0;

  return outfits.map(pending => {
    const source = pending.sourceIndex;
    let target = -1;

    if (source != null && source >= 0 && source < size && !taken.has(source)) {
      target = source;
    } else {
      while (cursor < size && (taken.has(cursor) || isSlotOccupied(cursor))) cursor++;
      if (cursor < size) target = cursor;
    }

    if (target >= 0) taken.add(target);
    return {id: ++serial, pending, target, selected: target >= 0};
  });
}

export function outfitLabel(entry: ImportEntry, index: number): string {
  return entry.pending.name?.trim() || t('wardrobe-import-untitled', {n: index + 1});
}

export function slotLabel(index: number): string {
  return `#${index + 1} ${slotName(index).trim() || t('wardrobe-import-slot-empty')}`;
}

export function entryStatus(entry: ImportEntry): ImportStatus {
  if (!entry.selected || entry.target < 0) return 'skip';
  return isSlotOccupied(entry.target) ? 'replace' : 'add';
}

export function retarget(entries: readonly ImportEntry[], id: number, target: number): ImportEntry[] {
  return entries.map(entry => {
    if (entry.id === id) return {...entry, target, selected: target >= 0};
    if (target >= 0 && entry.target === target) return {...entry, target: -1, selected: false};
    return entry;
  });
}

export function toggleEntry(entries: readonly ImportEntry[], id: number): ImportEntry[] {
  return entries.map(entry =>
    entry.id === id && entry.target >= 0 ? {...entry, selected: !entry.selected} : entry);
}

export function toggleAll(entries: readonly ImportEntry[]): ImportEntry[] {
  const selectable = entries.filter(entry => entry.target >= 0);
  const allOn = selectable.length > 0 && selectable.every(entry => entry.selected);
  return entries.map(entry => entry.target >= 0 ? {...entry, selected: !allOn} : entry);
}

export function countByStatus(entries: readonly ImportEntry[]): Record<ImportStatus, number> {
  const counts: Record<ImportStatus, number> = {add: 0, replace: 0, skip: 0};
  for (const entry of entries) counts[entryStatus(entry)]++;
  return counts;
}