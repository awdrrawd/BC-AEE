import {getCurrentCharacter, getCurrentItem} from '@/core/bc';
import {forceUiUpdate} from '@/core/context';

interface WceOverrideSetting {
  Hide: Record<string, AssetGroupName[]>;
}

function defaultHide(item: Item | null): AssetGroupName[] {
  return Array.isArray(item?.Asset?.Hide) ? [...item.Asset.Hide] : [];
}

export function getLayeringHideGroups(item: Item | null): AssetGroupName[] {
  return defaultHide(item);
}

export function getLayeringHideGroupLabel(item: Item, group: AssetGroupName): string {
  return AssetGroupGet(item.Asset.Group.Family, group)?.Description || group;
}

export function getLayeringHiddenGroups(item: Item | null): AssetGroupName[] {
  const override = item?.Property?.wceOverrideHide;
  return Array.isArray(override) ? override.filter(group => defaultHide(item).includes(group)) : defaultHide(item);
}

export function hasLayeringHideOverride(item: Item | null): boolean {
  return Array.isArray(item?.Property?.wceOverrideHide);
}

function readWceOverrides(): WceOverrideSetting {
  try {
    const compressed = Player?.ExtensionSettings?.WCEOverrides;
    const parsed = typeof compressed === 'string' ? JSON.parse(LZString.decompressFromUTF16(compressed) || 'null') as Partial<WceOverrideSetting> | null : null;
    return {Hide: parsed?.Hide && typeof parsed.Hide === 'object' ? {...parsed.Hide} : {}};
  } catch {
    return {Hide: {}};
  }
}

function syncPlayerFallback(item: Item) {
  const character = getCurrentCharacter();
  if (!character?.IsPlayer?.() || !Player?.ExtensionSettings) return;
  const data = readWceOverrides();
  const group = item.Asset.Group.Name;
  if (Array.isArray(item.Property?.wceOverrideHide)) data.Hide[group] = [...item.Property.wceOverrideHide];
  else delete data.Hide[group];
  Player.ExtensionSettings.WCEOverrides = LZString.compressToUTF16(JSON.stringify(data));
  ServerPlayerExtensionSettingsSync('WCEOverrides');
}

function commit(item: Item, hidden: AssetGroupName[], restoreDefault = false) {
  const defaults = defaultHide(item);
  item.Property ??= {};
  if (restoreDefault) delete item.Property.wceOverrideHide;
  else item.Property.wceOverrideHide = defaults.filter(group => hidden.includes(group));
  syncPlayerFallback(item);
  const character = getCurrentCharacter();
  if (character) CharacterRefresh(character, false, false);
  forceUiUpdate();
}

export function setLayeringGroupHidden(group: AssetGroupName, hidden: boolean) {
  const item = getCurrentItem();
  if (!item || !defaultHide(item).includes(group)) return;
  const groups = new Set(getLayeringHiddenGroups(item));
  if (hidden) groups.add(group);
  else groups.delete(group);
  commit(item, [...groups]);
}

export function resetLayeringHide() {
  const item = getCurrentItem();
  if (item) commit(item, defaultHide(item), true);
}

export function restoreWceOverrides(character: Character) {
  if (!character.IsPlayer?.() || !Array.isArray(character.Appearance)) return false;
  const data = readWceOverrides();
  let changed = false;
  for (const [group, hide] of Object.entries(data.Hide)) {
    const item = InventoryGet(character, group as AssetGroupName);
    if (!item || Array.isArray(item.Property?.wceOverrideHide) || !Array.isArray(hide)) continue;
    const valid = defaultHide(item).filter(name => hide.includes(name));
    item.Property ??= {};
    item.Property.wceOverrideHide = valid;
    changed = true;
  }
  return changed;
}
