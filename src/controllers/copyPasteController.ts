import {t} from '@/i18n/i18n';
import {getState} from '@/core/store';
import {COPY_ICON, PASTE_ICON} from '@/controllers/copyPasteIcons';

// "Copy a worn item (with all its state) and paste it onto another group/character
// that can wear the same asset." Rendered as a button just left of BC's per-row
// strip/use buttons in the appearance groups list. The buffer is intentionally
// kept across screens and characters so you can copy on one player and paste on
// another; it is only cleared via the top-bar Clear button or toggling the
// feature off.

interface CopyBuffer {
  assetName: string;
  color: ItemColor | undefined;
  property: ItemProperties | undefined;
  // Kept alongside assetName so we can render a thumbnail of the copied item
  // (see drawCopyBufferPreview below) without having to re-resolve it through
  // AssetGet, which needs a family+group we may no longer have handy.
  asset: Asset;
}

type RowButton = 'paste' | 'copy' | null;

const BUTTON_SIZE = 65;
const ROW_Y0 = 145;
const ROW_PITCH = 95;
// BC lays its row buttons on a 90px step (65 wide + 25 gap); we sit one step left
// of whatever BC's leftmost button is, so we hug the cluster instead of leaving a
// gap when a row has no Use/Strip button.
const COLUMN_STEP = 90;

let copyBuffer: CopyBuffer | null = null;
// Which groups can wear a given asset is fixed by the asset definitions, so it
// is cached per family+asset name rather than recomputed every frame.
const groupsForAssetCache = new Map<string, Set<string>>();

function cloneValue<T>(value: T): T {
  if (value == null) return value;
  try {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

function groupsForAsset(family: IAssetFamily, assetName: string): Set<string> {
  const key = `${family}:${assetName}`;
  let cached = groupsForAssetCache.get(key);
  if (!cached) {
    cached = new Set<string>();
    for (const group of AssetGroup) {
      if (group && AssetGet(family, group.Name, assetName)) cached.add(group.Name);
    }
    groupsForAssetCache.set(key, cached);
  }
  return cached;
}

function isGroupEditable(character: Character, groupName: string): boolean {
  return typeof AppearanceGroupAllowed !== 'function' || AppearanceGroupAllowed(character, groupName);
}

function canPasteToGroup(character: Character, family: IAssetFamily, groupName: string, buffer: CopyBuffer): boolean {
  if (!groupsForAsset(family, buffer.assetName).has(groupName)) return false;
  return isGroupEditable(character, groupName);
}

// True when this worn item could be pasted onto some other visible/editable
// group, i.e. it is worth offering a Copy button on its row.
function hasVisiblePasteTargets(character: Character, family: IAssetFamily, srcGroup: string, item: Item): boolean {
  const assetName = item.Asset?.Name;
  if (!assetName) return false;
  const targets = groupsForAsset(family, assetName);
  for (const group of CharacterAppearanceGroups) {
    if (!group || group.Name === srcGroup) continue;
    if (targets.has(group.Name) && isGroupEditable(character, group.Name)) return true;
  }
  return false;
}

// Single source of truth for what (if any) button a row shows, shared by the
// renderer and the click handler so they can never disagree.
function rowButtonKind(character: Character, family: IAssetFamily, group: AssetGroup, item: Item | null, buffer: CopyBuffer | null): RowButton {
  if (buffer && canPasteToGroup(character, family, group.Name, buffer)) return 'paste';
  if (item && hasVisiblePasteTargets(character, family, group.Name, item)) return 'copy';
  return null;
}

// x of our button for a row: one column-step left of BC's leftmost row button.
// BC draws Use at 1120, Strip at 1030 (when both present) or 1120 (when alone);
// with neither, our anchor is the name box at 1210.
function rowButtonX(item: Item | null, group: AssetGroup): number {
  const hasUse = !!item?.Asset?.Extended;
  const hasStrip = !!item && !!group.AllowNone;
  let bcLeftmost: number;
  if (hasUse && hasStrip) bcLeftmost = 1030;
  else if (hasUse || hasStrip) bcLeftmost = 1120;
  else bcLeftmost = 1210;
  return bcLeftmost - COLUMN_STEP;
}

// AppearanceMenuBuild only runs on menu changes, so when our copy state flips we
// rebuild it ourselves to show/hide the top-bar Clear button right away.
function rebuildAppearanceMenu() {
  try {
    if (typeof AppearanceMenuBuild === 'function' && CharacterAppearanceSelection) {
      AppearanceMenuBuild(CharacterAppearanceSelection);
    }
  } catch {
    // Ignore menu rebuild failures.
  }
}

function copyFrom(character: Character, groupName: AssetGroupName) {
  const item = InventoryGet(character, groupName);
  if (!item?.Asset) return;
  copyBuffer = {
    assetName: item.Asset.Name,
    color: cloneValue(item.Color),
    property: cloneValue(item.Property),
    asset: item.Asset,
  };
  rebuildAppearanceMenu();
}

function pasteTo(character: Character, groupName: AssetGroupName) {
  const buffer = copyBuffer;
  if (!buffer) return;
  const asset = AssetGet(character.AssetFamily, groupName, buffer.assetName);
  if (!asset) return;
  try {
    CharacterAppearanceSetItem(character, groupName, asset, cloneValue(buffer.color) ?? null);
    const item = InventoryGet(character, groupName);
    if (item && buffer.property) item.Property = cloneValue(buffer.property);
    CharacterLoadCanvas(character);
  } catch {
    // Ignore transient render/inventory errors.
  }
}

// Draws a thumbnail of whatever is currently in the copy buffer into a
// size x size box at (x, y), so the top-bar cancel-copy button shows what
// will be pasted instead of a generic icon.
//
// Important: this uses BC's own DrawAssetPreview - the same function behind
// the flat item icons in the wardrobe/selection grids - rather than trying
// to hand-build an image path ourselves. An earlier attempt built a path
// from AssetGetPreviewPath + DynamicPreviewImage, which is the *worn*
// preview image (tall, character-shaped) used elsewhere in BC, not the
// square icon used in item-picker grids; it also wasn't reliably sized to
// fill the button. DrawAssetPreview handles both the correct image and its
// own load-not-ready/missing-image fallback internally.
export function drawCopyBufferPreview(x: number, y: number, size: number, character: Character | null, fallbackIcon: string): void {
  const inset = 2;
  const innerX = x + inset;
  const innerY = y + inset;
  const innerSize = size - inset * 2;
  if (copyBuffer && typeof DrawAssetPreview === 'function') {
    try {
      DrawAssetPreview(innerX, innerY, copyBuffer.asset, {
        Width: innerSize,
        Height: innerSize,
        Border: false,
        Hover: false,
        // Without this, DrawAssetPreview falls back to the asset's own
        // Description and reserves a text row for it beneath the image,
        // which is what was making the icon render smaller than the box.
        // We just want the plain image, sized to fill the whole button.
        Description: '',
        C: character ?? undefined,
      });
      return;
    } catch {
      // Fall through to the static fallback icon below.
    }
  }
  if (typeof DrawImageResize === 'function') {
    try {
      DrawImageResize(fallbackIcon, innerX, innerY, innerSize, innerSize);
    } catch {
      // Nothing further we can do - leave whatever the caller already drew.
    }
  }
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
  return typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode === ''
    && typeof CharacterAppearanceGroups !== 'undefined'
    && typeof CharacterAppearanceOffset !== 'undefined'
    && typeof CharacterAppearanceNumGroupPerPage !== 'undefined'
    && !isAppearanceOverlayActive();
}

// Layering and the extended-item dialog draw as DOM overlays on top of the
// same appearance screen without changing CharacterAppearanceMode, so
// isGroupsList() alone can't tell they're up - our canvas buttons would
// otherwise keep drawing (and, worse, still accepting clicks) underneath
// them. Exported so the top-bar clear-copy button (in menuHooks.ts) can
// apply the same guard.
export function isAppearanceOverlayActive(): boolean {
  if (typeof Layering !== 'undefined' && typeof Layering.IsActive === 'function' && Layering.IsActive()) return true;
  if (typeof DialogFocusItem !== 'undefined' && DialogFocusItem != null) return true;
  return false;
}

export function drawGroupCopyPasteButtons() {
  if (!getState().enableCopyPaste) return;
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

// Returns true when the click landed on one of our buttons (and was handled), so
// the caller can stop BC from also processing it.
export function handleGroupCopyPasteClick(): boolean {
  if (!getState().enableCopyPaste) return false;
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
