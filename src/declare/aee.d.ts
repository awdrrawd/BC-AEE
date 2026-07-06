// Extend TextCache with the mod's custom static text cache for appearance menu labels.
// TypeScript merges class and namespace declarations, so this adds static properties.
namespace TextCache {
  let Text_Appearance: Record<string, string>;
}

// Augment AppearanceMenu to accept the mod's custom menu button identifier.
// DialogMenuButtonType is a union type alias and cannot be merged — the
// workaround is to widen the variable declaration here so our custom string
// ("AEE_ClearCopy") is assignable. Export/Import reuse BC's own 'Copy'/
// 'Paste' identifiers (see hooks/menuHooks.ts) so they don't need an entry
// here.
type DialogMenuButtonTypeOverride = 'AEE_ClearCopy' | DialogMenuButtonType;
declare let AppearanceMenu: DialogMenuButtonTypeOverride[];
