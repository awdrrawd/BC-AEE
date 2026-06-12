import {t} from '@/i18n/i18n';
import {mutateState} from '@/core/store';
import type {AppearanceImportItem, AssetGroupReference, BcxExportItem, CharacterWithAppearance} from '@/core/types';

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
      const decoded = decodeURIComponent(escape(atob(clipboardText)));
      const parsed: unknown = JSON.parse(decoded);
      if (isAppearanceList(parsed)) appearance = parsed;
    } catch {
      // Try BC native paste below.
    }
  }

  if (appearance) {
    const normalized = appearance.map(item => {
      if (item.Asset) return item;
      return {
        Asset: {Group: {Name: item.Group}, Name: item.Name},
        Group: item.Group,
        Name: item.Name,
        Color: item.Color,
        Property: item.Property,
        Difficulty: item.Difficulty,
      };
    });
    mutateState(draft => {
      draft.importDialog = {character, appearance: normalized};
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

export function closeImportDialog() {
  mutateState(draft => {
    draft.importDialog = null;
  });
}

export function getAppearanceItemCategory(item: AppearanceImportItem): 'clothes' | 'body' | 'restraints' | 'other' {
  const groupName = item.Asset?.Group?.Name ?? item.Group;
  if (!groupName) return 'other';
  const assetGroup = typeof AssetGroup !== 'undefined'
    ? AssetGroup.find(entry => entry.Name === groupName)
    : null;
  if (!assetGroup) return 'other';
  if (assetGroup.Category === 'Appearance') {
    if (assetGroup.Clothing === false) return 'body';
    return 'clothes';
  }
  return 'restraints';
}

export function applyImportCategories(character: CharacterWithAppearance, appearance: AppearanceImportItem[], selectedCategories: Set<string>) {
  const filtered = appearance.filter(item => selectedCategories.has(getAppearanceItemCategory(item)));
  if (!filtered.length) {
    alert(t('import-controller-no-matching-items-alert'));
    return;
  }

  try {
    const existingToRemove = character.Appearance.filter(item => {
      const groupName = item.Asset?.Group?.Name ?? item.Group;
      return groupName && selectedCategories.has(getAppearanceItemCategory({Group: groupName}));
    });

    for (const item of existingToRemove) {
      const groupName = item.Asset?.Group?.Name ?? item.Group;
      if (typeof InventoryRemove === 'function') {
        try {
          InventoryRemove(character, groupName as AssetGroupName, false);
        } catch {
          // Ignore missing or locked inventory groups while replacing categories.
        }
      } else {
        const index = character.Appearance.findIndex(entry => (entry.Asset?.Group?.Name ?? entry.Group) === groupName);
        if (index >= 0) character.Appearance.splice(index, 1);
      }
    }

    for (const entry of filtered) {
      const groupName = entry.Asset?.Group?.Name ?? entry.Group;
      const itemName = entry.Asset?.Name ?? entry.Name;
      if (!groupName || !itemName) continue;
      try {
        InventoryWear(character, itemName, groupName as AssetGroupName, entry.Color ?? 'Default', null, null, null, false);
        if (entry.Property != null) {
          const worn = InventoryGet(character, groupName as AssetGroupName)
            ?? character.Appearance.find(item => (item.Asset?.Group?.Name ?? item.Group) === groupName);
          if (worn) worn.Property = JSON.parse(JSON.stringify(entry.Property));
        }
        if (entry.Difficulty != null) {
          const worn = InventoryGet(character, groupName as AssetGroupName)
            ?? character.Appearance.find(item => (item.Asset?.Group?.Name ?? item.Group) === groupName);
          if (worn) worn.Difficulty = entry.Difficulty;
        }
      } catch (error) {
        console.warn('[AEE] InventoryWear failed:', groupName, itemName, error);
      }
    }

    CharacterRefresh(character, false);
    if (CurrentScreen === 'ChatRoom') ChatRoomCharacterUpdate(character);
    ChatRoomSendLocal(t('import-controller-import-success-message', {count: filtered.length}));
  } catch (error) {
    console.error('[AEE] Import failed:', error);
    alert(t('import-controller-import-failed-alert', {error: String(error)}));
  } finally {
    closeImportDialog();
  }
}

function isAppearanceList(value: unknown): value is AppearanceImportItem[] {
  return Array.isArray(value) && value.length > 0 && value.every(isAppearanceItemLike);
}

function isAppearanceItemLike(value: unknown): value is AppearanceImportItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as AppearanceImportItem;
  const asset = item.Asset;
  const group = asset?.Group as AssetGroupReference | undefined;
  return Boolean((group?.Name ?? item.Group) && (asset?.Name ?? item.Name));
}
