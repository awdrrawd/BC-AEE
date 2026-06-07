import {isZh} from '../core/lang';
import {mutateState} from '../core/store';
import type {AppearanceImportItem, AssetGroupReference, BcxExportItem, CharacterWithAppearance} from '../core/types';

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
      alert('[AEE] No appearance data');
      return;
    }

    const output = LZString.compressToBase64(JSON.stringify(bundle));
    navigator.clipboard.writeText(output).then(() => {
      ChatRoomSendLocal(isZh()
        ? `[AEE] 外觀已匯出（${bundle.length} 件）`
        : `[AEE] Exported ${bundle.length} items`);
    }).catch(() => {
      prompt('[AEE] Copy this:', output);
    });
  } catch (error) {
    console.error('[AEE] Export failed:', error);
    alert('[AEE] Export failed: ' + error);
  }
}

export async function importBcxAppearanceWithCategory(character: Character) {
  let clipboardText = '';
  try {
    clipboardText = await navigator.clipboard.readText();
  } catch (error) {
    console.error('[AEE] Cannot read clipboard:', error);
    alert('[AEE] Cannot read clipboard');
    return;
  }
  clipboardText = clipboardText.trim();
  if (!clipboardText) {
    alert('[AEE] Clipboard is empty');
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
  alert('[AEE] ' + (isZh() ? '無法解析剪貼板內容（請先用 AEE/BCX 匯出）' : 'Cannot parse clipboard content (please export with AEE/BCX first)'));
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
    alert('[AEE] ' + (isZh() ? '沒有符合的物件' : 'No matching items'));
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
        InventoryWear?.(character, itemName, groupName as AssetGroupName, entry.Color ?? 'Default', null, null, null, false);
        if (entry.Property != null) {
          const worn = InventoryGet?.(character, groupName as AssetGroupName)
            ?? character.Appearance.find(item => (item.Asset?.Group?.Name ?? item.Group) === groupName);
          if (worn) worn.Property = JSON.parse(JSON.stringify(entry.Property));
        }
        if (entry.Difficulty != null) {
          const worn = InventoryGet?.(character, groupName as AssetGroupName)
            ?? character.Appearance.find(item => (item.Asset?.Group?.Name ?? item.Group) === groupName);
          if (worn) worn.Difficulty = entry.Difficulty;
        }
      } catch (error) {
        console.warn('[AEE] InventoryWear failed:', groupName, itemName, error);
      }
    }

    CharacterRefresh?.(character, false);
    if (CurrentScreen === 'ChatRoom') ChatRoomCharacterUpdate?.(character);
    ChatRoomSendLocal?.(isZh()
      ? `[AEE] 已匯入 ${filtered.length} 個物件`
      : `[AEE] Imported ${filtered.length} items`);
  } catch (error) {
    console.error('[AEE] Import failed:', error);
    alert('[AEE] Import failed: ' + error);
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
