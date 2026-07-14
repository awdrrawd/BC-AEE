import {t} from '@/i18n/i18n';
import {mutateState} from '@/core/store';
import {askText} from '@/core/prompts';
import {bundleAppearance, bundleItem, decodeBundles, encodeBundle, itemFromBundle, wearBundle} from '@/util/appearanceBundle';
import {showToast} from '@/util/toast';
import type {ImportCategoryKey, ImportDiff, ImportDiffDialog} from '@/core/types';

export function exportBcxAppearance(character: Character | null | undefined) {
  try {
    const bundle = bundleAppearance(character?.Appearance ?? []);
    if (!bundle.length) {
      showToast(t('export-controller-no-appearance-data-alert'));
      return;
    }

    const code = encodeBundle(bundle);
    navigator.clipboard.writeText(code)
      .then(() => showToast(t('export-controller-export-success-message', {count: bundle.length})))
      .catch(() => void askText(t('export-controller-copy-fallback-prompt'), code));
  } catch (error) {
    console.error('[AEE] Export failed:', error);
    showToast(t('export-controller-export-failed-alert', {error: String(error)}), {duration: 5000});
  }
}

export async function importBcxAppearanceWithCategory(character: Character) {
  let clipboardText = '';
  try {
    clipboardText = (await navigator.clipboard.readText()).trim();
  } catch (error) {
    console.error('[AEE] Cannot read clipboard:', error);
    await promptManualImport(character);
    return;
  }
  if (!clipboardText) {
    await promptManualImport(character);
    return;
  }
  importBcxFromText(character, clipboardText);
}

async function promptManualImport(character: Character) {
  const text = (await askText(t('import-controller-manual-paste-prompt')) ?? '').trim();
  if (text) importBcxFromText(character, text);
}

export function importBcxFromText(character: Character, rawText: string) {
  const clipboardText = (rawText ?? '').trim();
  if (!clipboardText) {
    showToast(t('import-controller-empty-clipboard-alert'));
    return;
  }

  const appearance = decodeBundles(clipboardText)?.[0];
  if (appearance) {
    const diffs = buildDiffList(character, appearance);
    if (!diffs.length) {
      showToast(t('import-controller-no-diff-alert'));
      return;
    }
    const originalAppearance = CharacterAppearanceStringify(character);
    mutateState(draft => {
      draft.importDialog = {character, diffs, originalAppearance};
    });
    return;
  }

  const beforePaste = CharacterAppearanceStringify(character);
  try {
    CharacterAppearancePaste(character, clipboardText, false);
    if (CharacterAppearanceStringify(character) !== beforePaste) return;
  } catch {
    // Fall through to the parse-error toast below.
  }
  showToast(t('import-controller-cannot-parse-clipboard-alert'));
}

const FULL_REPLACE_CATEGORIES: ReadonlySet<ImportCategoryKey> = new Set<ImportCategoryKey>([
  'clothes', 'cosplay', 'body', 'restraints',
]);

export function categorizeGroup(groupName: AssetGroupName): ImportCategoryKey {
  const group = AssetGroupGet('Female3DCG', groupName);
  if (!group) return 'other';
  if (group.Category === 'Item') return group.BodyCosplay ? 'other' : 'restraints';
  if (group.Category !== 'Appearance') return 'other';
  if (!group.Clothing) return 'body';
  if (!group.AllowNone) return 'other';
  return group.BodyCosplay ? 'cosplay' : 'clothes';
}

export function groupDisplayName(groupName: AssetGroupName): string {
  return AssetGroupGet('Female3DCG', groupName)?.Description || groupName;
}

function describeItem(item: Item | null): string {
  if (!item) return t('import-dialog-empty-slot');
  const craftName = item.Craft?.Name?.trim();
  return craftName ? `${craftName} (${item.Asset.Description})` : item.Asset.Description;
}

export function buildDiffList(character: Character, bundle: ItemBundle[]): ImportDiff[] {
  const diffs: ImportDiff[] = [];
  const appearance = character.Appearance;
  const bundleGroups = new Set<AssetGroupName>();

  for (const entry of bundle) {
    const incoming = itemFromBundle(character, entry);
    if (!incoming) continue;

    const groupName = incoming.Asset.Group.Name;
    bundleGroups.add(groupName);

    const worn = InventoryGet(character, groupName);
    const target = bundleItem(incoming);
    if (worn && JSON.stringify(bundleItem(worn)) === JSON.stringify(target)) continue;

    diffs.push({
      group: groupName,
      category: categorizeGroup(groupName),
      changeType: worn ? 'modify' : 'add',
      entry: target,
      fromText: describeItem(worn),
      toText: describeItem(incoming),
    });
  }

  for (const item of appearance) {
    const group = item.Asset.Group;
    if (bundleGroups.has(group.Name)) continue;
    if (!group.AllowNone) continue; // a mandatory slot can't be emptied
    const category = categorizeGroup(group.Name);
    if (!FULL_REPLACE_CATEGORIES.has(category)) continue;

    diffs.push({
      group: group.Name,
      category,
      changeType: 'remove',
      entry: null, // nothing to wear: this slot is being emptied
      fromText: describeItem(item),
      toText: t('import-dialog-empty-slot'),
    });
  }

  return diffs;
}

export function applyImportPreview(dialog: ImportDiffDialog, selectedGroups: ReadonlySet<AssetGroupName>) {
  const {character, diffs, originalAppearance} = dialog;

  CharacterAppearanceRestore(character, originalAppearance);
  for (const diff of diffs) {
    if (!selectedGroups.has(diff.group)) continue;
    if (diff.entry) wearBundle(character, diff.entry);
    else InventoryRemove(character, diff.group, false);
  }
  CharacterRefresh(character, false);
}

export function commitImport(dialog: ImportDiffDialog, selectedGroups: ReadonlySet<AssetGroupName>) {
  try {
    applyImportPreview(dialog, selectedGroups);
    const count = dialog.diffs.filter(diff => selectedGroups.has(diff.group)).length;
    if (CurrentScreen === 'ChatRoom') ChatRoomCharacterUpdate(dialog.character);
    showToast(t('import-controller-import-success-message', {count}));
  } catch (error) {
    console.error('[AEE] Import failed:', error);
    showToast(t('import-controller-import-failed-alert', {error: String(error)}), {duration: 5000});
  } finally {
    closeImportDialog();
  }
}

export function cancelImport(dialog: ImportDiffDialog) {
  CharacterAppearanceRestore(dialog.character, dialog.originalAppearance);
  CharacterRefresh(dialog.character, false);
  closeImportDialog();
}

export function closeImportDialog() {
  mutateState(draft => {
    draft.importDialog = null;
  });
}
