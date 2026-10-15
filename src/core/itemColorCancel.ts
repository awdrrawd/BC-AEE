// R133 narrowed what the colour screen's "Cancel" restores.
//
// R132: ItemColorExitClick (DEFAULT mode) and ItemColorCancelAndExit both put
//       the WHOLE item back from the backup taken in ItemColorLoad
//       (`Object.assign(item, AppearanceItemParse(ItemColorBackup))`).
// R133: they only restore `Color` and `Property.Opacity`.
//
// AEE edits other item properties (LayerOverrides, OverridePriority, ...) while
// the colour screen is open and has no revert path of its own for worn items;
// it relied on BC's full restore. Running the R132 restore ourselves first
// keeps Cancel meaning "discard everything". It is idempotent, so it is
// harmless on R132 where BC repeats it right after.

/** The parser BC uses for `ItemColorBackup` (typed `Item[]` upstream, but it returns the item object). */
type BackupParser = (stringified: string) => unknown;

export function restoreItemFromColorBackup(item: Item, backup: string, parse: BackupParser): void {
  const restored = parse(backup) as Partial<Item>;
  Object.assign(item, restored);
  // Object.assign never removes keys. When the item had no Property while the
  // colour screen was opened (the backup is taken before BC sanitises it), the
  // current Property still holds our edits. R133's own cancel code writes
  // `item.Property.Opacity`, so reset it to an empty object, not `undefined`.
  if (!('Property' in restored)) item.Property = {};
}
