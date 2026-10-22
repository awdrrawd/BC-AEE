
type HeartLockApi = {
  isHeartLock(item: Item | ItemBundle): boolean;
  isProtected(character: Character, group: string): boolean;
  sanitizeOutfitItem<T extends ItemBundle>(entry: T): T;
};
function api(): Partial<HeartLockApi> | undefined {
  return (window as unknown as {Liko?: {AFC?: {heartLock?: HeartLockApi}}}).Liko?.AFC?.heartLock;
}
// The lock fields sit in the same place in a live item's Property and in a bundle's (minimized) Property;
// only BC's per-layer maps differ between the two, and nothing here touches those.
const asBundleProperty = (property: Item['Property']) => property as unknown as ItemBundle['Property'];
const asItemProperty = (property: ItemBundle['Property']) => property as unknown as Item['Property'];

export function hasHeartLock(item: Item | ItemBundle): boolean {
  const property = item.Property as unknown as {HeartLockId?: string; Name?: string} | undefined;
  return api()?.isHeartLock?.(item) ?? !!(property?.HeartLockId || property?.Name === 'Heart Padlock');
}
export function protectedGroup(character: Character, group: string): boolean {
  return api()?.isProtected?.(character, group)
    ?? character.Appearance.some(item => item.Asset.Group.Name === group && hasHeartLock(item));
}
export function sanitizeHeartLock(entry: ItemBundle): ItemBundle {
  if (!hasHeartLock(entry)) return entry;
  const sanitize = api()?.sanitizeOutfitItem;
  if (sanitize) return sanitize(entry);
  const copy = CommonCloneDeep(entry);
  const property = copy.Property as unknown as ItemProperties & {HeartLockId?: string; Name?: string};
  ValidationDeleteLock(property, false);
  delete property.HeartLockId;
  delete property.Name;
  return copy;
}
// Live snapshots retain their locks; only portable outfits are sanitized.
export function preserveHeartLocks(character: Character, operation: () => void): void {
  const protectedItems = character.Appearance.filter(hasHeartLock);
  try { operation(); }
  finally {
    const groups = new Set(protectedItems.map(item => item.Asset.Group.Name));
    character.Appearance = character.Appearance.filter(item => !groups.has(item.Asset.Group.Name)).map(item => {
      if (!hasHeartLock(item)) return item;
      const entry = sanitizeHeartLock({Name: item.Asset.Name, Group: item.Asset.Group.Name, Property: asBundleProperty(item.Property)});
      return {...item, Property: asItemProperty(entry.Property)};
    });
    character.Appearance.push(...protectedItems);
  }
}
