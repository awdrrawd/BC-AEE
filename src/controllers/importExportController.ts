import {t} from '@/i18n/i18n';
import {mutateState} from '@/core/store';
import type {AppearanceImportItem, BcxExportItem, ImportCategoryKey, ImportDiff, ImportDiffDialog} from '@/core/types';

export function exportBcxAppearance(character: Character | null | undefined) {
  try {
    const bundle = (character?.Appearance || []).map((item): BcxExportItem | null => {
      const groupName = item.Asset?.Group?.Name ?? item.Group;
      const itemName = item.Asset?.Name ?? item.Name;
      if (!groupName || !itemName) return null;
      const entry: BcxExportItem = {
        Group: groupName,
        Name: itemName,
      };
      if (item.Color != null) entry.Color = item.Color;
      if (item.Property != null) entry.Property = item.Property;
      if (item.Difficulty != null) entry.Difficulty = item.Difficulty;
      return entry;
    }).filter((entry): entry is BcxExportItem => entry !== null);

    if (!bundle.length) {
      alert(t('export-controller-no-appearance-data-alert'));
      return;
    }

    const output = LZString.compressToBase64(JSON.stringify(bundle));
    navigator.clipboard.writeText(output).then(() => {
      ChatRoomSendLocal(t('export-controller-export-success-message', {count: bundle.length}));
    }).catch(() => {
      prompt(t('export-controller-copy-fallback-prompt'), output);
    });
  } catch (error) {
    console.error('[AEE] Export failed:', error);
    alert(t('export-controller-export-failed-alert', {error: String(error)}));
  }
}

export async function importBcxAppearanceWithCategory(character: Character) {
  let clipboardText = '';
  try {
    clipboardText = await navigator.clipboard.readText();
  } catch (error) {
    console.error('[AEE] Cannot read clipboard:', error);
    alert(t('import-controller-cannot-read-clipboard-alert'));
    return;
  }
  clipboardText = clipboardText.trim();
  if (!clipboardText) {
    alert(t('import-controller-empty-clipboard-alert'));
    return;
  }

  let appearance: AppearanceImportItem[] | null = null;
  const decoded = LZString.decompressFromBase64(clipboardText);
  if (decoded) {
    const parsed: unknown = JSON.parse(decoded);
    if (isAppearanceList(parsed)) appearance = parsed;
  }

  if (!appearance) {
    try {
      const fallback = decodeURIComponent(escape(atob(clipboardText)));
      const parsed: unknown = JSON.parse(fallback);
      if (isAppearanceList(parsed)) appearance = parsed;
    } catch {
      // Try BC native paste below.
    }
  }

  if (appearance) {
    const diffs = buildDiffList(character, appearance);
    if (!diffs.length) {
      alert(t('import-controller-no-diff-alert'));
      return;
    }
    const originalAppearance = CharacterAppearanceStringify(character);
    mutateState(draft => {
      draft.importDialog = {character, diffs, originalAppearance};
    });
    return;
  }

  try {
    CharacterAppearancePaste(character, clipboardText, false);
    return;
  } catch {
    // Show parse error below.
  }
  alert(t('import-controller-cannot-parse-clipboard-alert'));
}

// ---------------------------------------------------------------------------
// Category classification
//
// Mirrors BCX's isCloth/isCosplay/isBody/isBind split using the plain BC
// AssetGroup fields (Category/AllowNone/Clothing/BodyCosplay). Any group that
// doesn't match a known shape — including groups registered by other mods —
// falls into "other" instead of being silently dropped, so modded resources
// stay importable.
// ---------------------------------------------------------------------------

const FULL_REPLACE_CATEGORIES: ReadonlySet<ImportCategoryKey> = new Set<ImportCategoryKey>([
  'clothes', 'cosplay', 'body', 'restraints',
]);

export function categorizeGroup(groupName: string | undefined): ImportCategoryKey {
  if (!groupName) return 'other';
  const group = typeof AssetGroup !== 'undefined'
    ? AssetGroup.find(entry => entry.Name === groupName)
    : null;
  if (!group) return 'other';
  if (group.Category === 'Appearance' && group.AllowNone && group.Clothing && !group.BodyCosplay) return 'clothes';
  if (group.Category === 'Appearance' && group.AllowNone && group.Clothing && group.BodyCosplay) return 'cosplay';
  if (group.Category === 'Appearance' && !group.Clothing) return 'body';
  if (group.Category === 'Item' && !group.BodyCosplay) return 'restraints';
  return 'other';
}

// The group's display name in the current game language (BC retranslates
// AssetGroup.Description whenever TranslationLanguage changes), falling back to
// the raw group name for groups the game has no localized name for.
export function groupDisplayName(groupName: string): string {
  const group = typeof AssetGroup !== 'undefined' ? AssetGroup.find(entry => entry.Name === groupName) : null;
  return group?.Description || groupName;
}

function describeAsset(character: Character, groupName: string, assetName: string | null | undefined): string {
  if (!assetName) return t('import-dialog-empty-slot');
  const asset = typeof AssetGet === 'function'
    ? AssetGet(character.AssetFamily, groupName as AssetGroupName, assetName)
    : null;
  return asset?.Description ?? assetName;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  } catch {
    return a === b;
  }
}

// Returns only the slots present in the bundle that would actually change on
// the character, plus full-replace slots the character currently fills but the
// bundle leaves out (so importing a skirt-only outfit removes the old pants
// instead of stacking both).
export function buildDiffList(character: Character, bundle: AppearanceImportItem[]): ImportDiff[] {
  const diffs: ImportDiff[] = [];
  const appearance = character.Appearance || [];
  const bundleGroups = new Set<string>();

  for (const entry of bundle) {
    const groupName = entry.Asset?.Group?.Name ?? entry.Group;
    const itemName = entry.Asset?.Name ?? entry.Name;
    if (!groupName || !itemName) continue;
    bundleGroups.add(groupName);

    const current = appearance.find(item => (item.Asset?.Group?.Name ?? item.Group) === groupName);
    const currentName = current?.Asset?.Name ?? current?.Name ?? null;

    const sameItem = currentName === itemName;
    const sameColor = valuesEqual(current?.Color ?? null, entry.Color ?? null);
    const sameProperty = valuesEqual(current?.Property ?? null, entry.Property ?? null);
    const sameDifficulty = (current?.Difficulty ?? 0) === (entry.Difficulty ?? 0);
    if (sameItem && sameColor && sameProperty && sameDifficulty) continue;

    diffs.push({
      group: groupName,
      category: categorizeGroup(groupName),
      // An empty slot gaining an item is an "add"; replacing/recoloring an
      // existing item is a "modify".
      changeType: currentName ? 'modify' : 'add',
      entry,
      fromText: describeAsset(character, groupName, currentName),
      toText: describeAsset(character, groupName, itemName),
    });
  }

  for (const item of appearance) {
    const groupName = item.Asset?.Group?.Name ?? item.Group;
    if (!groupName || bundleGroups.has(groupName)) continue;
    const group = typeof AssetGroup !== 'undefined' ? AssetGroup.find(entry => entry.Name === groupName) : null;
    if (!group || !group.AllowNone) continue; // mandatory slots can't be emptied
    const category = categorizeGroup(groupName);
    if (!FULL_REPLACE_CATEGORIES.has(category)) continue;

    diffs.push({
      group: groupName,
      category,
      changeType: 'remove',
      entry: {Group: groupName, Name: undefined},
      fromText: describeAsset(character, groupName, item.Asset?.Name ?? item.Name),
      toText: t('import-dialog-empty-slot'),
    });
  }

  return diffs;
}

// ---------------------------------------------------------------------------
// Live preview + apply
// ---------------------------------------------------------------------------

function applyDiffEntry(character: Character, entry: AppearanceImportItem) {
  const groupName = entry.Asset?.Group?.Name ?? entry.Group;
  const itemName = entry.Asset?.Name ?? entry.Name;
  if (!groupName) return;

  if (!itemName) {
    if (typeof InventoryRemove === 'function') {
      try {
        InventoryRemove(character, groupName as AssetGroupName, false);
      } catch {
        // Ignore missing or locked groups while emptying a slot.
      }
    }
    return;
  }

  if (typeof InventoryWear !== 'function') return;
  try {
    InventoryWear(character, itemName, groupName as AssetGroupName, entry.Color ?? 'Default', null, null, null, false);
    const worn = (typeof InventoryGet === 'function' ? InventoryGet(character, groupName as AssetGroupName) : null)
      ?? character.Appearance.find(item => (item.Asset?.Group?.Name ?? item.Group) === groupName);
    if (worn) {
      if (entry.Property != null) worn.Property = JSON.parse(JSON.stringify(entry.Property));
      if (entry.Difficulty != null) worn.Difficulty = entry.Difficulty;
    }
  } catch (error) {
    // Items from a mod the importing user doesn't have can't be worn; skip them
    // rather than aborting the whole import.
    console.warn('[AEE] InventoryWear failed:', groupName, itemName, error);
  }
}

// Re-applies the full selection from the original snapshot every time, so
// toggling a checkbox off cleanly reverts that slot.
export function applyImportPreview(dialog: ImportDiffDialog, selectedGroups: ReadonlySet<string>) {
  const {character, diffs, originalAppearance} = dialog;
  CharacterAppearanceRestore(character, originalAppearance);
  for (const diff of diffs) {
    if (!selectedGroups.has(String(diff.group))) continue;
    applyDiffEntry(character, diff.entry);
  }
  if (typeof CharacterRefresh === 'function') CharacterRefresh(character, false);
}

export function commitImport(dialog: ImportDiffDialog, selectedGroups: ReadonlySet<string>) {
  try {
    applyImportPreview(dialog, selectedGroups);
    const count = dialog.diffs.filter(diff => selectedGroups.has(String(diff.group))).length;
    if (CurrentScreen === 'ChatRoom') ChatRoomCharacterUpdate(dialog.character);
    ChatRoomSendLocal(t('import-controller-import-success-message', {count}));
  } catch (error) {
    console.error('[AEE] Import failed:', error);
    alert(t('import-controller-import-failed-alert', {error: String(error)}));
  } finally {
    closeImportDialog();
  }
}

export function cancelImport(dialog: ImportDiffDialog) {
  CharacterAppearanceRestore(dialog.character, dialog.originalAppearance);
  if (typeof CharacterRefresh === 'function') CharacterRefresh(dialog.character, false);
  closeImportDialog();
}

export function closeImportDialog() {
  mutateState(draft => {
    draft.importDialog = null;
  });
}

function isAppearanceList(value: unknown): value is AppearanceImportItem[] {
  return Array.isArray(value) && value.length > 0 && value.every(isAppearanceItemLike);
}

function isAppearanceItemLike(value: unknown): value is AppearanceImportItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as AppearanceImportItem;
  const groupName = item.Asset?.Group?.Name ?? item.Group;
  const itemName = item.Asset?.Name ?? item.Name;
  return Boolean(groupName && itemName);
}