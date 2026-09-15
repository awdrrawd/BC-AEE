// Match the native Layering save contract. Do not persist AEE-only properties
// (e.g. LayerOverrides), or copy unrelated lock/extended-item state into Craft.
const craftingLayerProperties = [
  'OverridePriority', 'TranslationX', 'TranslationY', 'ScaleX', 'ScaleY', 'Rotation',
  'LayerTranslationX', 'LayerTranslationY', 'LayerScaleX', 'LayerScaleY', 'LayerRotation',
] as const;
const craftingPreviewProperties = [...craftingLayerProperties, 'LayerOverrides'] as const;

export interface CraftingColorSession {
  craft: CraftingItemSelected;
  character: Character;
  item: Item;
}

export function beginCraftingColorSession(character: Character, item: Item): CraftingColorSession | null {
  if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'Crafting'
    || typeof CraftingPreview === 'undefined' || character !== CraftingPreview
    || typeof CraftingSelectedItem === 'undefined' || !CraftingSelectedItem?.Asset
    || item?.Asset !== CraftingSelectedItem.Asset) return null;

  // InventoryCraft can share nested property maps with the selected Craft.
  // Detach BEFORE ItemColorLoad takes its cancel backup, so preview changes
  // cannot leak into the craft when the user cancels the colour screen.
  if (item.Property) item.Property = CommonCloneDeep(item.Property);
  return {craft: CraftingSelectedItem, character, item};
}

export function saveCraftingColorSession(session: CraftingColorSession | null, save: boolean): boolean {
  if (!save || !session || CurrentScreen !== 'Crafting'
    || CraftingSelectedItem !== session.craft || CraftingPreview !== session.character
    || session.item.Asset !== session.craft.Asset) return false;

  const property = session.craft.ItemProperty ??= {};
  for (const key of craftingLayerProperties) {
    const value = session.item.Property?.[key];
    // Deletions are intentional resets; retaining the previous value would
    // resurrect it on the next preview rebuild or when wearing the craft.
    if (value == null) delete property[key];
    else property[key] = CommonCloneDeep(value) as never;
  }
  return true;
}

// CraftingUpdatePreview wears a separate item for every eligible body group.
// Keep those copies in step with the item edited by ItemColor, before BC sorts
// and renders its layers. Never copy extended-item state between body groups.
export function syncCraftingColorPreview(session: CraftingColorSession | null, character: Character): void {
  if (!session || CurrentScreen !== 'Crafting' || character !== session.character
    || character !== CraftingPreview || CraftingSelectedItem !== session.craft
    || !character.Appearance?.includes(session.item)
    || typeof CraftingAssets === 'undefined') return;

  const assets = CraftingAssets[session.item.Asset.Name] ?? [];
  for (const item of character.Appearance) {
    if (item === session.item || !assets.includes(item.Asset)) continue;
    // Replace only drawing properties; unrelated nested state is never mutated.
    const property = {...item.Property};
    for (const key of craftingPreviewProperties) {
      const value = session.item.Property?.[key];
      if (value == null) delete property[key];
      else property[key] = CommonCloneDeep(value) as never;
    }
    item.Property = property;
    item.Color = CommonCloneDeep(session.item.Color);
  }
}
