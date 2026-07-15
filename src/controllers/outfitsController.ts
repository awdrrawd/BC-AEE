import {t} from '@/i18n/i18n';
import {bundleAppearance, decodeBundles, encodeBundle, wearBundle} from '@/util/appearanceBundle';
import {showToast} from '@/util/toast';
import {getSlotMeta, onlineWardrobeSize, persistLocalWardrobe, setSlotMeta} from '@/core/wardrobeStorage';
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

export const GRID_COLS = 3;
export const GRID_ROWS = 2;
export const PER_PAGE = GRID_COLS * GRID_ROWS;

export function slotName(index: number): string {
  return Player.WardrobeCharacterNames?.[index] ?? '';
}

export function isSlotOccupied(index: number): boolean {
  return !!Player.Wardrobe?.[index]?.length;
}

export function filterSlots(search: string, filter: WardrobeFilter, sort: WardrobeSortMode): number[] {
  let indices = Array.from({length: WardrobeSize}, (_, index) => index);

  const term = search.trim().toLowerCase();
  if (term) indices = indices.filter(index => slotName(index).toLowerCase().includes(term));

  if (filter === 'favorite') {
    indices = indices.filter(index => getSlotMeta(index).favorite);
  } else if (filter) {
    indices = indices.filter(index => getSlotMeta(index).tags.includes(filter));
  }

  switch (sort) {
    case 'name':
      indices.sort((a, b) => slotName(a).localeCompare(slotName(b)));
      break;
    case 'favorite':
      indices.sort((a, b) => Number(getSlotMeta(b).favorite) - Number(getSlotMeta(a).favorite));
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
  return Math.max(1, Math.ceil(slots.length / PER_PAGE));
}

export function getOccupiedSlots(): OccupiedSlot[] {
  const slots: OccupiedSlot[] = [];
  for (let index = 0; index < WardrobeSize; index++) {
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

function persistWardrobeChanges(indices: readonly number[]): boolean {
  try {
    WardrobeFixLength();
    if (!persistLocalWardrobe()) throw new Error('Local wardrobe storage is full or unavailable');

    const onlineSize = onlineWardrobeSize();
    if (indices.some(index => index < onlineSize)) {
      ServerAccountUpdate.QueueData({
        Wardrobe: CharacterCompressWardrobe(Player.Wardrobe.slice(0, onlineSize)),
        WardrobeCharacterNames: Player.WardrobeCharacterNames.slice(0, onlineSize),
      });
    }
    return true;
  } catch (error) {
    console.error('🐈‍⬛ [AEE] Failed to persist wardrobe changes', error);
    showToast(t('wardrobe-toast-save-failed'));
    return false;
  }
}

export function saveOutfit(index: number, name: string) {
  if (index < 0 || index >= WardrobeSize || !Player.Wardrobe) return;
  const character = getTargetCharacter();
  const resolved = name.trim().slice(0, 40) || slotName(index).trim() || (character.Name || Player.Name || '').trim();

  try {
    Player.Wardrobe[index] = buildOutfitBundle(character);
    Player.WardrobeCharacterNames[index] = resolved;
    if (!persistWardrobeChanges([index])) return;
  } catch (error) {
    console.error('🐈‍⬛ [AEE] ❌ Failed to save the outfit', error);
    showToast(t('wardrobe-toast-save-failed'));
    return;
  }

  bumpWardrobeData();
  showToast(t('wardrobe-toast-saved'));
}

export function tryOnOutfit(index: number) {
  if (index < 0 || index >= WardrobeSize || !Player.Wardrobe) return;
  const character = getTargetCharacter();

  try {
    applyOutfit(character, Player.Wardrobe[index] ?? []);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to wear the outfit', error);
    return;
  }

  CharacterRefresh(character, false);
  bumpWardrobeData();
}

export function deleteOutfit(index: number) {
  if (index < 0 || !isSlotOccupied(index)) return;

  Player.Wardrobe[index] = [];
  Player.WardrobeCharacterNames[index] = '';
  setSlotMeta(index, {favorite: false, tags: []});
  persistWardrobeChanges([index]);
  if (getWardrobeState().selection === index) setWardrobeState({selection: -1, name: ''});
  bumpWardrobeData();
}

export function swapOutfits(a: number, b: number) {
  if (a < 0 || b < 0 || a >= WardrobeSize || b >= WardrobeSize || a === b) return;
  const outfit = Player.Wardrobe[a];
  Player.Wardrobe[a] = Player.Wardrobe[b];
  Player.Wardrobe[b] = outfit;

  const name = Player.WardrobeCharacterNames[a];
  Player.WardrobeCharacterNames[a] = Player.WardrobeCharacterNames[b];
  Player.WardrobeCharacterNames[b] = name;

  const meta = getSlotMeta(a);
  setSlotMeta(a, getSlotMeta(b));
  setSlotMeta(b, meta);
  persistWardrobeChanges([a, b]);
  bumpWardrobeData();
}

export function toggleFavorite(index: number) {
  setSlotMeta(index, {favorite: !getSlotMeta(index).favorite});
  bumpWardrobeData();
}

export function setSlotTags(index: number, tags: string[]) {
  setSlotMeta(index, {tags});
  bumpWardrobeData();
}

export function knownTags(): string[] {
  const tags = new Set<string>(settings.wardrobeCategories.get());
  for (let index = 0; index < WardrobeSize; index++) {
    for (const tag of getSlotMeta(index).tags) tags.add(tag);
  }
  return [...tags];
}

export function exportOutfitToClipboard(index: number) {
  const bundle = Player.Wardrobe?.[index];
  if (!bundle?.length) return;

  navigator.clipboard.writeText(encodeBundle(bundle))
    .then(() => showToast(t('wardrobe-toast-exported')))
    .catch(error => {
      console.warn('🐈‍⬛ [AEE] Failed to write the outfit code to the clipboard', error);
      showToast(t('wardrobe-toast-export-failed'));
    });
}

export function importOutfitFromCode(index: number, code: string) {
  const bundle = decodeBundles(code)?.[0];
  if (!bundle || !Player.Wardrobe || index < 0 || index >= WardrobeSize) {
    showToast(t('wardrobe-toast-import-failed'));
    return;
  }
  Player.Wardrobe[index] = bundle;
  if (!persistWardrobeChanges([index])) return;
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
  if (!Player.Wardrobe) return 0;

  const changed: number[] = [];
  for (const {pending, target} of plan) {
    if (target < 0 || target >= WardrobeSize) continue;
    Player.Wardrobe[target] = pending.outfit;
    if (pending.name) Player.WardrobeCharacterNames[target] = pending.name.slice(0, 40);
    if (pending.meta) setSlotMeta(target, pending.meta);
    changed.push(target);
  }
  if (!changed.length) return 0;

  persistWardrobeChanges(changed);
  bumpWardrobeData();
  showToast(t('wardrobe-toast-import-count', {n: changed.length}));
  return changed.length;
}
