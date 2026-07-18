import {t} from '@/i18n/i18n';
import {bundleAppearance, decodeBundles, encodeBundle, wearBundle} from '@/util/appearanceBundle';
import {showToast} from '@/util/toast';
import {activeWardrobeSource, getSlotMeta, setSlotMeta, type WardrobeSource} from '@/core/wardrobeStorage';
import {
  buildWardrobeFile,
  collectWardrobeSlots,
  downloadJson,
  parseWardrobeFile,
  wardrobeFileName,
} from '@/core/wardrobeFile';
import {bumpWardrobeData, getTargetCharacter, getWardrobeState, setWardrobeState} from '@/core/wardrobeStore';
import type {OccupiedSlot, PendingImport, WardrobeFilter, WardrobeSortMode} from '@/core/types';
import {settings} from '@/core/settings';

export const GRID_ROWS = 2;
const BASE_GRID_COLS = 3;
// Side panels that can be hidden; each hidden one widens the grid by one column.
const HIDEABLE_SIDE_PANELS = ['list', 'manage', 'preview'];

export function gridColumns(): number {
  const layout = settings.wardrobePanelLayout.get();
  const hidden = HIDEABLE_SIDE_PANELS.filter(id => !layout.includes(id)).length;
  return BASE_GRID_COLS + hidden;
}

export function perPage(): number {
  return gridColumns() * GRID_ROWS;
}

export function slotName(index: number): string {
  return activeWardrobeSource().nameAt(index);
}

export function isSlotOccupied(index: number): boolean {
  return activeWardrobeSource().outfitAt(index).length > 0;
}

export function filterSlots(search: string, filter: WardrobeFilter, sort: WardrobeSortMode): number[] {
  const source = activeWardrobeSource();
  let indices = Array.from({length: source.size()}, (_, index) => index);

  const term = search.trim().toLowerCase();
  if (term) indices = indices.filter(index => slotName(index).toLowerCase().includes(term));

  if (filter === 'favorite') {
    indices = indices.filter(index => getSlotMeta(source.id, index).favorite);
  } else if (filter) {
    indices = indices.filter(index => getSlotMeta(source.id, index).tags.includes(filter));
  }

  switch (sort) {
    case 'name':
      indices.sort((a, b) => slotName(a).localeCompare(slotName(b)));
      break;
    case 'favorite':
      indices.sort((a, b) => Number(getSlotMeta(source.id, b).favorite) - Number(getSlotMeta(source.id, a).favorite));
      break;
    case 'occupied':
      indices.sort((a, b) => Number(isSlotOccupied(b)) - Number(isSlotOccupied(a)));
      break;
    default:
      break;
  }
  return indices;
}

export function pageCount(slots: number[]): number {
  return Math.max(1, Math.ceil(slots.length / perPage()));
}

export function getOccupiedSlots(): OccupiedSlot[] {
  const source = activeWardrobeSource();
  const slots: OccupiedSlot[] = [];
  for (let index = 0; index < source.size(); index++) {
    if (isSlotOccupied(index)) slots.push({index, name: slotName(index) || `Slot ${index + 1}`});
  }
  return slots;
}

type SlotCategory = 'cloth' | 'body' | 'item' | 'other';

function categorise(group: AssetGroup): SlotCategory {
  if (group.Category === 'Item') return 'item';
  if (group.Category !== 'Appearance') return 'other';
  return group.Clothing ? 'cloth' : 'body';
}

function shouldSave(group: AssetGroup): boolean {
  switch (categorise(group)) {
    case 'cloth': return true;
    case 'body': return settings.wardrobeIncludeBody.get();
    case 'item': return settings.wardrobeIncludeItems.get();
    default: return false;
  }
}

function buildOutfitBundle(character: Character): ItemBundle[] {
  const saved = character.Appearance.filter(item => shouldSave(item.Asset.Group));
  return bundleAppearance(saved).map(sanitise);
}

function sanitise(entry: ItemBundle): ItemBundle {
  if (!entry.Property) return entry;

  const property: ItemProperties & {LockName?: string; LockSet?: boolean} = {...entry.Property};
  delete property.Expression;
  delete property.LockedBy;
  delete property.LockMemberNumber;
  delete property.LockName;
  delete property.LockSet;
  delete property.RemoveTimer;
  if (property.Effect) property.Effect = property.Effect.filter(effect => effect !== 'Lock');

  return {...entry, Property: property};
}

function applyOutfit(character: Character, bundle: ItemBundle[]) {
  const wear = new Map<AssetGroupName, ItemBundle>();
  for (const entry of bundle) {
    const asset = AssetGet(character.AssetFamily, entry.Group, entry.Name);
    if (!asset || categorise(asset.Group) === 'other') continue;
    wear.set(entry.Group, entry);
  }

  const replaceBody = bundle.some(entry => {
    const asset = AssetGet(character.AssetFamily, entry.Group, entry.Name);
    return !!asset && categorise(asset.Group) === 'body';
  });

  character.Appearance = character.Appearance.filter(item => {
    const group = item.Asset.Group;
    if (wear.has(group.Name)) return true; // outfit provides it → re-applied below
    const category = categorise(group);
    // Clothing is always a full replace; body too, but only when the outfit brought its own.
    // Restraints/items — and a bodyless outfit's body/hair — stay on.
    return category !== 'cloth' && !(replaceBody && category === 'body');
  });

  wear.forEach(entry => wearBundle(character, entry));
}

interface SlotSnapshot {
  index: number;
  outfit: ItemBundle[];
  name: string;
}

function snapshotSlots(source: WardrobeSource, indices: readonly number[]): SlotSnapshot[] {
  return indices.map(index => ({index, outfit: source.outfitAt(index), name: source.nameAt(index)}));
}

/**
 * Persists the slots covered by the snapshots, rolling the in-memory slots back
 * when the underlying storage rejects the write (quota / server size cap).
 */
function commitWardrobeChanges(source: WardrobeSource, snapshots: readonly SlotSnapshot[]): boolean {
  if (source.persist(snapshots.map(snapshot => snapshot.index))) return true;
  snapshots.forEach(snapshot => source.writeSlot(snapshot.index, snapshot.outfit, snapshot.name));
  showToast(t(source.id === 'online' ? 'wardrobe-toast-online-full' : 'wardrobe-toast-save-failed'));
  return false;
}

export function saveOutfit(index: number, name: string) {
  const source = activeWardrobeSource();
  if (index < 0 || index >= source.size()) return;
  const character = getTargetCharacter();
  const resolved = name.trim().slice(0, 40) || slotName(index).trim() || (character.Name || Player.Name || '').trim();

  try {
    const snapshots = snapshotSlots(source, [index]);
    source.writeSlot(index, buildOutfitBundle(character), resolved);
    if (!commitWardrobeChanges(source, snapshots)) return;
  } catch (error) {
    console.error('🐈‍⬛ [AEE] ❌ Failed to save the outfit', error);
    showToast(t('wardrobe-toast-save-failed'));
    return;
  }

  bumpWardrobeData();
  showToast(t('wardrobe-toast-saved'));
}

export function tryOnOutfit(index: number) {
  const source = activeWardrobeSource();
  if (index < 0 || index >= source.size()) return;
  const character = getTargetCharacter();

  try {
    applyOutfit(character, source.outfitAt(index));
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to wear the outfit', error);
    return;
  }

  CharacterRefresh(character, false);
  bumpWardrobeData();
}

export function deleteOutfit(index: number) {
  if (index < 0 || !isSlotOccupied(index)) return;

  const source = activeWardrobeSource();
  const snapshots = snapshotSlots(source, [index]);
  source.writeSlot(index, [], '');
  if (!commitWardrobeChanges(source, snapshots)) return;

  setSlotMeta(source.id, index, {favorite: false, tags: []});
  if (getWardrobeState().selection === index) setWardrobeState({selection: -1, name: ''});
  bumpWardrobeData();
}

export function swapOutfits(a: number, b: number) {
  const source = activeWardrobeSource();
  if (a < 0 || b < 0 || a >= source.size() || b >= source.size() || a === b) return;

  const snapshots = snapshotSlots(source, [a, b]);
  source.swap(a, b);
  if (!commitWardrobeChanges(source, snapshots)) return;

  const meta = getSlotMeta(source.id, a);
  setSlotMeta(source.id, a, getSlotMeta(source.id, b));
  setSlotMeta(source.id, b, meta);
  bumpWardrobeData();
}

export function toggleFavorite(index: number) {
  const source = activeWardrobeSource();
  setSlotMeta(source.id, index, {favorite: !getSlotMeta(source.id, index).favorite});
  bumpWardrobeData();
}

export function setSlotTags(index: number, tags: string[]) {
  setSlotMeta(activeWardrobeSource().id, index, {tags});
  bumpWardrobeData();
}

export function knownTags(): string[] {
  const source = activeWardrobeSource();
  const tags = new Set<string>(settings.wardrobeCategories.get());
  for (let index = 0; index < source.size(); index++) {
    for (const tag of getSlotMeta(source.id, index).tags) tags.add(tag);
  }
  return [...tags];
}

export function exportOutfitToClipboard(index: number) {
  const bundle = activeWardrobeSource().outfitAt(index);
  if (!bundle.length) return;

  navigator.clipboard.writeText(encodeBundle(bundle))
    .then(() => showToast(t('wardrobe-toast-exported')))
    .catch(error => {
      console.warn('🐈‍⬛ [AEE] Failed to write the outfit code to the clipboard', error);
      showToast(t('wardrobe-toast-export-failed'));
    });
}

/** Copies the target character's currently worn outfit to the clipboard (no slot involved). */
export function exportWornToClipboard() {
  const bundle = buildOutfitBundle(getTargetCharacter());
  if (!bundle.length) {
    showToast(t('wardrobe-toast-export-failed'));
    return;
  }

  navigator.clipboard.writeText(encodeBundle(bundle))
    .then(() => showToast(t('wardrobe-toast-exported')))
    .catch(error => {
      console.warn('🐈‍⬛ [AEE] Failed to write the worn outfit code to the clipboard', error);
      showToast(t('wardrobe-toast-export-failed'));
    });
}

/** Applies a pasted outfit code directly onto the target character. */
export function importCodeToWorn(code: string) {
  const bundle = decodeBundles(code)?.[0];
  if (!bundle) {
    showToast(t('wardrobe-toast-import-failed'));
    return;
  }
  const character = getTargetCharacter();
  try {
    applyOutfit(character, bundle);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to wear the imported outfit', error);
    showToast(t('wardrobe-toast-import-failed'));
    return;
  }
  CharacterRefresh(character, false);
  bumpWardrobeData();
  showToast(t('wardrobe-toast-imported'));
}

export function importOutfitFromCode(index: number, code: string) {
  const source = activeWardrobeSource();
  const bundle = decodeBundles(code)?.[0];
  if (!bundle || index < 0 || index >= source.size()) {
    showToast(t('wardrobe-toast-import-failed'));
    return;
  }
  const snapshots = snapshotSlots(source, [index]);
  source.writeSlot(index, bundle, snapshots[0].name);
  if (!commitWardrobeChanges(source, snapshots)) return;
  bumpWardrobeData();
  showToast(t('wardrobe-toast-imported'));
}

export function exportWardrobeToFile() {
  const slots = collectWardrobeSlots();
  if (!slots.length) {
    showToast(t('wardrobe-toast-file-empty'));
    return;
  }

  try {
    downloadJson(wardrobeFileName(), JSON.stringify(buildWardrobeFile(slots), null, 2));
  } catch (error) {
    console.error('🐈‍⬛ [AEE] Failed to export the wardrobe file', error);
    showToast(t('wardrobe-toast-export-failed'));
    return;
  }
  showToast(t('wardrobe-toast-file-exported', {n: slots.length}));
}

export async function readImportFile(file: File): Promise<PendingImport[] | null> {
  let outfits: PendingImport[] | null = null;
  try {
    outfits = parseWardrobeFile(await file.text());
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to read the wardrobe file', error);
  }

  if (!outfits?.length) {
    showToast(t('wardrobe-toast-file-import-failed'));
    return null;
  }

  showToast(t('wardrobe-toast-file-loaded', {n: outfits.length}));
  return outfits;
}

export function readImportCode(code: string): PendingImport[] | null {
  const outfits = decodeBundles(code);
  if (!outfits?.length) {
    showToast(t('wardrobe-toast-import-failed'));
    return null;
  }
  return outfits.map(outfit => ({outfit}));
}

export function applyImports(plan: readonly { pending: PendingImport; target: number }[]): number {
  const source = activeWardrobeSource();
  const entries = plan.filter(({target}) => target >= 0 && target < source.size());
  if (!entries.length) return 0;

  const snapshots = snapshotSlots(source, entries.map(entry => entry.target));
  for (const {pending, target} of entries) {
    source.writeSlot(target, pending.outfit, pending.name ? pending.name.slice(0, 40) : source.nameAt(target));
  }
  if (!commitWardrobeChanges(source, snapshots)) return 0;

  for (const {pending, target} of entries) {
    if (pending.meta) setSlotMeta(source.id, target, pending.meta);
  }
  bumpWardrobeData();
  showToast(t('wardrobe-toast-import-count', {n: entries.length}));
  return entries.length;
}
