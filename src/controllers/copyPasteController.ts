import {t} from '@/i18n/i18n';

import {bundleItem, wearBundle} from '@/util/appearanceBundle';
import {COPY_ICON, PASTE_ICON} from '@/controllers/copyPasteIcons';
import {settings} from '@/core/settings';

interface CopyBuffer {
  entry: ItemBundle;
  asset: Asset;
}

type RowButton = 'paste' | 'copy' | null;

const BUTTON_SIZE = 65;
const ROW_Y0 = 145;
const ROW_PITCH = 95;
const COLUMN_STEP = 90;

let copyBuffer: CopyBuffer | null = null;

const groupsForAsset = CommonMemoize((family: IAssetFamily, assetName: string): Set<AssetGroupName> => {
  const groups = AssetGroup.filter(group => AssetGet(family, group.Name, assetName));
  return new Set(groups.map(group => group.Name));
});

function isGroupEditable(character: Character, groupName: AssetGroupName): boolean {
  return AppearanceGroupAllowed(character, groupName);
}

function canPasteToGroup(character: Character, family: IAssetFamily, groupName: AssetGroupName, buffer: CopyBuffer): boolean {
  if (!groupsForAsset(family, buffer.entry.Name).has(groupName)) return false;
  return isGroupEditable(character, groupName);
}

function hasVisiblePasteTargets(character: Character, family: IAssetFamily, srcGroup: AssetGroupName, item: Item): boolean {
  const assetName = item.Asset?.Name;
  if (!assetName) return false;
  const targets = groupsForAsset(family, assetName);
  for (const group of CharacterAppearanceGroups) {
    if (!group || group.Name === srcGroup) continue;
    if (targets.has(group.Name) && isGroupEditable(character, group.Name)) return true;
  }
  return false;
}

function rowButtonKind(character: Character, family: IAssetFamily, group: AssetGroup, item: Item | null, buffer: CopyBuffer | null): RowButton {
  if (buffer && canPasteToGroup(character, family, group.Name, buffer)) return 'paste';
  if (item && hasVisiblePasteTargets(character, family, group.Name, item)) return 'copy';
  return null;
}

function rowButtonX(item: Item | null, group: AssetGroup): number {
  const hasUse = !!item?.Asset?.Extended;
  const hasStrip = !!item && !!group.AllowNone;
  let bcLeftmost: number;
  if (hasUse && hasStrip) bcLeftmost = 1030;
  else if (hasUse || hasStrip) bcLeftmost = 1120;
  else bcLeftmost = 1210;
  return bcLeftmost - COLUMN_STEP;
}

function rebuildAppearanceMenu() {
  if (CharacterAppearanceSelection) AppearanceMenuBuild(CharacterAppearanceSelection);
}

function copyFrom(character: Character, groupName: AssetGroupName) {
  const item = InventoryGet(character, groupName);
  if (!item) return;
  copyBuffer = {entry: bundleItem(item), asset: item.Asset};
  rebuildAppearanceMenu();
}

function pasteTo(character: Character, groupName: AssetGroupName) {
  if (!copyBuffer) return;
  if (wearBundle(character, {...copyBuffer.entry, Group: groupName})) CharacterLoadCanvas(character);
}

export function drawCopyBufferPreview(x: number, y: number, size: number, character: Character | null, fallbackIcon: string): void {
  const inset = 2;
  const innerX = x + inset;
  const innerY = y + inset;
  const innerSize = size - inset * 2;

  if (!copyBuffer) {
    DrawImageResize(fallbackIcon, innerX, innerY, innerSize, innerSize);
    return;
  }

  DrawAssetPreview(innerX, innerY, copyBuffer.asset, {
    Width: innerSize,
    Height: innerSize,
    Border: false,
    Hover: false,
    Description: '',
    C: character ?? undefined,
  });
}

export function isCopyActive(): boolean {
  return copyBuffer !== null;
}

export function clearCopyBuffer() {
  if (copyBuffer === null) return;
  copyBuffer = null;
  rebuildAppearanceMenu();
}

function isGroupsList(): boolean {
  return CharacterAppearanceMode === '' && !isAppearanceOverlayActive();
}

export function isAppearanceOverlayActive(): boolean {
  return Layering.IsActive() || DialogFocusItem != null;
}

export function drawGroupCopyPasteButtons() {
  if (!settings.enableCopyPaste.get()) return;
  const character = CharacterAppearanceSelection;
  if (!character || !isGroupsList()) return;
  const family = character.AssetFamily;
  const offset = CharacterAppearanceOffset;
  const end = Math.min(CharacterAppearanceGroups.length, offset + CharacterAppearanceNumGroupPerPage);
  for (let index = offset; index < end; index++) {
    const group = CharacterAppearanceGroups[index];
    if (!group) continue;
    const item = InventoryGet(character, group.Name);
    const kind = rowButtonKind(character, family, group, item, copyBuffer);
    if (!kind) continue;
    const x = rowButtonX(item, group);
    const y = ROW_Y0 + (index - offset) * ROW_PITCH;
    if (kind === 'paste') {
      DrawButton(x, y, BUTTON_SIZE, BUTTON_SIZE, '', '#A7E8A7', PASTE_ICON, t('paste-item-tooltip'));
    } else {
      DrawButton(x, y, BUTTON_SIZE, BUTTON_SIZE, '', 'White', COPY_ICON, t('copy-item-tooltip'));
    }
  }
}

export function handleGroupCopyPasteClick(): boolean {
  if (!settings.enableCopyPaste.get()) return false;
  const character = CharacterAppearanceSelection;
  if (!character || !isGroupsList()) return false;
  const family = character.AssetFamily;
  const offset = CharacterAppearanceOffset;
  const end = Math.min(CharacterAppearanceGroups.length, offset + CharacterAppearanceNumGroupPerPage);
  for (let index = offset; index < end; index++) {
    const group = CharacterAppearanceGroups[index];
    if (!group) continue;
    const item = InventoryGet(character, group.Name);
    const y = ROW_Y0 + (index - offset) * ROW_PITCH;
    if (!MouseIn(rowButtonX(item, group), y, BUTTON_SIZE, BUTTON_SIZE)) continue;
    const kind = rowButtonKind(character, family, group, item, copyBuffer);
    if (kind === 'paste') pasteTo(character, group.Name);
    else if (kind === 'copy') copyFrom(character, group.Name);
    return kind !== null;
  }
  return false;
}
