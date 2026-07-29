export function bundleAppearance(items: readonly Item[]): ItemBundle[] {
  return CommonCloneDeep(ServerAppearanceBundle(items));
}

// Every lock-related field BC stores on an item's Property (see ItemProperties "Lock properties").
const LOCK_PROPERTY_KEYS = [
  'LockedBy', 'LockMemberNumber', 'LockMemberName', 'LockMessage',
  'Password', 'LockPickSeed', 'CombinationNumber', 'MemberNumberListKeys',
  'Hint', 'LockSet', 'RemoveItem', 'RemoveOnUnlock', 'ShowTimer',
  'EnableRandomInput', 'MemberNumberList',
] as const satisfies readonly (keyof ItemProperties)[];

/**
 * Returns a copy of the bundle entry with any padlock removed — clears the lock
 * properties and drops the "Lock" effect. Non-mutating: the original entry (which
 * may be a stored wardrobe slot) is left untouched.
 */
export function stripLock(entry: ItemBundle): ItemBundle {
  if (!entry.Property) return entry;
  const property: ItemProperties = {...entry.Property};
  for (const key of LOCK_PROPERTY_KEYS) delete property[key];
  if (Array.isArray(property.Effect)) {
    const effect = property.Effect.filter(name => name !== 'Lock');
    if (effect.length) property.Effect = effect;
    else delete property.Effect;
  }
  return {...entry, Property: property};
}

export function bundleItem(item: Item): ItemBundle {
  return bundleAppearance([item])[0];
}

export function itemFromBundle(character: Character, entry: ItemBundle): Item | null {
  return ServerBundledItemToAppearanceItem(character.AssetFamily, CommonCloneDeep(entry));
}

export function wearBundle(character: Character, entry: ItemBundle): Item | null {
  const item = itemFromBundle(character, entry);
  if (!item) return null;

  CharacterAppearanceSetItem(character, item.Asset.Group.Name, null); // no asset = empty the group
  character.Appearance.push(item);
  return item;
}

export function encodeBundle(bundle: ItemBundle[]): string {
  return LZString.compressToBase64(JSON.stringify(bundle));
}

export function decodeBundles(code: string): ItemBundle[][] | null {
  const parsed = decodeBundleJson(code.trim());
  if (!Array.isArray(parsed)) return null;

  const outfits = isOutfit(parsed) ? [parsed] : parsed.filter(isOutfit);
  return outfits.length > 0 ? outfits : null;
}

function decodeBundleJson(code: string): unknown {
  const texts = [
    () => LZString.decompressFromBase64(code),
    () => new TextDecoder().decode(Uint8Array.from(atob(code), char => char.charCodeAt(0))),
  ];

  for (const text of texts) {
    try {
      const json = text();
      if (json) return JSON.parse(json) as unknown; // decompressFromBase64 returns null on garbage
    } catch { /* not this format */ }
  }
  return null;
}

function isOutfit(value: unknown): value is ItemBundle[] {
  return Array.isArray(value) && value.length > 0 && value.every((entry: Partial<ItemBundle> | null) =>
    !!entry && typeof entry.Group === 'string' && typeof entry.Name === 'string');
}
