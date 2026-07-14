export function bundleAppearance(items: readonly Item[]): ItemBundle[] {
  return CommonCloneDeep(ServerAppearanceBundle(items));
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
