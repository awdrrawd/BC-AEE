// Extend TextCache with the mod's custom static text cache for appearance menu labels.
// TypeScript merges class and namespace declarations, so this adds static properties.
namespace TextCache {
  let Text_Appearance: Record<string, string>;
}

// Augment AppearanceMenu to accept the mod's custom menu button identifiers.
// DialogMenuButtonType is a union type alias and cannot be merged — the
// workaround is to widen the variable declaration here so our custom
// strings ("AEE_Export", "AEE_Import") are assignable.
type DialogMenuButtonTypeOverride = 'AEE_Export' | 'AEE_Import' | DialogMenuButtonType;
declare let AppearanceMenu: DialogMenuButtonTypeOverride[];
