import bcAeeModSdk from '@/modsdk';

import {exportBcxAppearance, importBcxAppearanceWithCategory, importBcxFromText} from '@/controllers/importExportController';
import {clearCopyBuffer, drawCopyBufferPreview, isAppearanceOverlayActive, isCopyActive} from '@/controllers/copyPasteController';
import {CLEAR_ICON} from '@/controllers/copyPasteIcons';
import {isInAppearanceScreen} from '@/core/appearanceScreenMachine';
import {cyclePartsFilterMode, drawPartsFilterBadge, isPartsFilterAvailable, partsFilterIcon, partsFilterTooltip} from '@/controllers/partsFilterController';
import {hideRestraintsIcon, hideRestraintsTooltip, isHideRestraintsActive, isHideRestraintsAvailable, toggleHideRestraints} from '@/controllers/hideRestraintsController';
import {t} from '@/i18n/i18n';
import {enterWardrobeScreen} from '@/hooks/wardrobeHooks';
import {settings} from '@/core/settings';
import {isHoverTryOnEnabled, toggleHoverTryOn, toggleCharacterPreviewActive} from '@/controllers/uiController';

const HOVER_TRY_ON_BUTTON = 'AEE_HoverTryOn';
const DIALOG_HOVER_TRY_ON_BUTTON = 'AEE_HoverTryOn' as DialogMenuButtonType;
const CHARACTER_PREVIEW_BUTTON = 'AEE_CharacterPreview';
const DIALOG_CHARACTER_PREVIEW_BUTTON = 'AEE_CharacterPreview' as DialogMenuButtonType;

// Groups that always get the character-grid preview, regardless of the
// characterPreviewActive toggle (which only gates regular clothing groups).
// Covers hair, eyes, eyebrows, mouth, and their ECHO-renamed equivalents.
const EXTENDED_FACE_PREVIEW_GROUPS = new Set([
  'HairFront', 'HairBack',
  'Eyes', 'Eyes2', 'Eyebrows', 'Mouth',
  '左眼_Luzi', '右眼_Luzi',
  '新前发_Luzi', '新后发_Luzi',
  '新前发_Luzi_stack', '新后发_Luzi_stack',
]);

function hoverTryOnIcon(): string {
  return isHoverTryOnEnabled() ? 'Icons/Public.png' : 'Icons/Private.png';
}

function characterPreviewIcon(): string {
  return settings.characterPreviewActive.get() ? 'Icons/Character.png' : 'Icons/CharacterOff.png';
}

function dialogHoverTryOnButtonX(): number {
  const index = DialogMenuButton.indexOf(DIALOG_HOVER_TRY_ON_BUTTON);
  return 1885 - (index >= 0 ? index : DialogMenuButton.length) * 110;
}

function dialogCharacterPreviewButtonX(): number {
  const index = DialogMenuButton.indexOf(DIALOG_CHARACTER_PREVIEW_BUTTON);
  return 1885 - (index >= 0 ? index : DialogMenuButton.length) * 110;
}

function isEditablePasteTarget(event: ClipboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable) return true;
  }
  return false;
}

export function installMenuHooks() {
  document.addEventListener('paste', event => {
    if (!settings.pasteImport.get()) return;
    if (CharacterAppearanceMode !== '') return;
    if (!isInAppearanceScreen()) return;
    if (isEditablePasteTarget(event)) return;
    const character = CharacterAppearanceSelection;
    if (!character) return;
    const text = event.clipboardData?.getData('text')?.trim();
    if (!text) return;
    event.preventDefault();
    void importBcxFromText(character, text);
  });

  bcAeeModSdk.hookFunction('AppearanceMenuBuild', 10, (args, next) => {
    next(args);
    if (CharacterAppearanceMode === '' && settings.hairCharacterPreview.get()) {
      AppearanceMenu = AppearanceMenu.filter(button => button !== 'Character');
    }
    if (CharacterAppearanceMode === 'Cloth' && settings.hoverTryOn.get()) {
      const randomIndex = AppearanceMenu.indexOf('WearRandom');
      if (randomIndex >= 0) AppearanceMenu[randomIndex] = HOVER_TRY_ON_BUTTON;
    }
    if (CharacterAppearanceMode === 'Cloth' && settings.hairCharacterPreview.get()) {
      const hoverIndex = AppearanceMenu.indexOf(HOVER_TRY_ON_BUTTON);
      if (hoverIndex >= 0) {
        AppearanceMenu.splice(hoverIndex + 1, 0, CHARACTER_PREVIEW_BUTTON);
      } else {
        const randomIndex = AppearanceMenu.indexOf('WearRandom');
        if (randomIndex >= 0) AppearanceMenu[randomIndex] = CHARACTER_PREVIEW_BUTTON;
        else AppearanceMenu.unshift(CHARACTER_PREVIEW_BUTTON);
      }
    }
    if (CharacterAppearanceMode !== '') return;
    if (settings.enableAeeMenu.get()) {
      AppearanceMenu = AppearanceMenu.filter((button) => button !== 'WearRandom' && button !== 'Random');
      AppearanceMenu = AppearanceMenu.filter((button) => button !== 'Copy' && button !== 'Paste');
      const wardrobeIndex = AppearanceMenu.findIndex((button) => button === 'Wardrobe' || button === 'WardrobeDisabled');
      if (wardrobeIndex >= 0) AppearanceMenu.splice(wardrobeIndex + 1, 0, 'Copy', 'Paste');
      else AppearanceMenu.unshift('Copy', 'Paste');
    }
    if (isPartsFilterAvailable() && !AppearanceMenu.includes('AEE_PartsFilter')) {
      AppearanceMenu.unshift('AEE_PartsFilter');
    }
    if (isHideRestraintsAvailable() && !AppearanceMenu.includes('AEE_HideRestraints')) {
      AppearanceMenu.unshift('AEE_HideRestraints');
    }
    if (settings.enableCopyPaste.get() && isCopyActive() && !isAppearanceOverlayActive() && !AppearanceMenu.includes('AEE_ClearCopy')) {
      AppearanceMenu.unshift('AEE_ClearCopy');
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuDraw', 10, (args, next) => {
    const menu = AppearanceMenu;
    const clearCopyIndex = menu.indexOf('AEE_ClearCopy');
    const partsFilterIndex = menu.indexOf('AEE_PartsFilter');
    const hideRestraintsIndex = menu.indexOf('AEE_HideRestraints');
    const hoverTryOnIndex = menu.indexOf(HOVER_TRY_ON_BUTTON);
    const charPreviewIndex = menu.indexOf(CHARACTER_PREVIEW_BUTTON);
    if (clearCopyIndex < 0 && partsFilterIndex < 0 && hideRestraintsIndex < 0 && hoverTryOnIndex < 0 && charPreviewIndex < 0) {
      next(args);
    } else {
      AppearanceMenu = menu.map((button, index) =>
        (index === clearCopyIndex || index === partsFilterIndex || index === hideRestraintsIndex || index === hoverTryOnIndex || index === charPreviewIndex ? 'Copy' : button));
      try {
        next(args);
      } finally {
        AppearanceMenu = menu;
      }
    }
    const x = 2000 - menu.length * 117;
    if (clearCopyIndex >= 0 && !isAppearanceOverlayActive()) {
      const clearCopyX = x + 117 * clearCopyIndex;
      DrawButton(clearCopyX, 25, 90, 90, '', 'White', null, t('copy-cancel-tooltip'));
      drawCopyBufferPreview(clearCopyX, 25, 90, CharacterAppearanceSelection ?? null, CLEAR_ICON);
    }
    if (hideRestraintsIndex >= 0 && !isAppearanceOverlayActive()) {
      const hideRestraintsX = x + 117 * hideRestraintsIndex;
      DrawButton(hideRestraintsX, 25, 90, 90, '', isHideRestraintsActive() ? '#FFB0B0' : 'White', hideRestraintsIcon(), hideRestraintsTooltip());
    }
    if (partsFilterIndex >= 0 && !isAppearanceOverlayActive()) {
      const partsFilterX = x + 117 * partsFilterIndex;
      DrawButton(partsFilterX, 25, 90, 90, '', 'White', partsFilterIcon(), partsFilterTooltip());
      drawPartsFilterBadge(partsFilterX, 25);
    }
    if (hoverTryOnIndex >= 0 && !isAppearanceOverlayActive()) {
      DrawButton(x + 117 * hoverTryOnIndex, 25, 90, 90, '', 'White', hoverTryOnIcon(), t('settings-hover-tryon-tooltip'));
    }
    if (charPreviewIndex >= 0 && !isAppearanceOverlayActive()) {
      DrawButton(x + 117 * charPreviewIndex, 25, 90, 90, '', 'White', characterPreviewIcon(), t('settings-character-preview-tooltip'));
    }
    if (settings.enableAeeMenu.get()) {
      for (let index = 0; index < menu.length; index++) {
        if (menu[index] === 'Copy') {
          DrawButton(x + 117 * index, 25, 90, 90, '', 'White', 'Icons/Copy.png', t('menu-export-tooltip'));
        }
        if (menu[index] === 'Paste') {
          DrawButton(x + 117 * index, 25, 90, 90, '', 'White', 'Icons/Paste.png', t('menu-import-tooltip'));
        }
      }
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuClick', 10, (args, next) => {
    const x = 2000 - AppearanceMenu.length * 117;
    for (let index = 0; index < AppearanceMenu.length; index++) {
      if (!MouseXIn(x + 117 * index, 90)) continue;
      if (settings.enableWardrobe.get() && AppearanceMenu[index] === 'Wardrobe') {
        enterWardrobeScreen();
        return;
      }
      if (settings.enableAeeMenu.get() && AppearanceMenu[index] === 'Copy') {
        exportBcxAppearance(CharacterAppearanceSelection);
        return;
      }
      if (settings.enableAeeMenu.get() && AppearanceMenu[index] === 'Paste') {
        importBcxAppearanceWithCategory(CharacterAppearanceSelection);
        return;
      }
      if (AppearanceMenu[index] === 'AEE_ClearCopy' && !isAppearanceOverlayActive()) {
        clearCopyBuffer();
        return;
      }
      if (AppearanceMenu[index] === 'AEE_PartsFilter' && !isAppearanceOverlayActive()) {
        cyclePartsFilterMode();
        return;
      }
      if (AppearanceMenu[index] === 'AEE_HideRestraints' && !isAppearanceOverlayActive()) {
        toggleHideRestraints();
        return;
      }
      if (AppearanceMenu[index] === HOVER_TRY_ON_BUTTON && !isAppearanceOverlayActive()) {
        toggleHoverTryOn();
        return;
      }
      if (AppearanceMenu[index] === CHARACTER_PREVIEW_BUTTON && !isAppearanceOverlayActive()) {
        toggleCharacterPreviewActive();
        return;
      }
    }
    return next(args);
  });

  bcAeeModSdk.hookFunction('DialogDrawTopMenu', 10, (args, next) => {
    const menu = DialogMenuButton;
    const hoverTryOnIndex = menu.indexOf(DIALOG_HOVER_TRY_ON_BUTTON);
    const charPreviewIndex = menu.indexOf(DIALOG_CHARACTER_PREVIEW_BUTTON);
    if (hoverTryOnIndex >= 0) {
      DialogMenuButton = menu.map((button, index) => index === hoverTryOnIndex ? 'Exit' : button);
    }
    if (charPreviewIndex >= 0) {
      DialogMenuButton = menu.map((button, index) => index === charPreviewIndex ? 'Exit' : button);
    }
    let result: ReturnType<typeof next>;
    try {
      result = next(args);
    } finally {
      DialogMenuButton = menu;
    }
    if (hoverTryOnIndex >= 0 && settings.hoverTryOn.get() && DialogMenuMode === 'items') {
      DrawButton(dialogHoverTryOnButtonX(), 15, 90, 90, '', 'White', hoverTryOnIcon(), t('settings-hover-tryon-tooltip'));
    }
    if (charPreviewIndex >= 0 && settings.hairCharacterPreview.get() && DialogMenuMode === 'items') {
      DrawButton(dialogCharacterPreviewButtonX(), 15, 90, 90, '', 'White', characterPreviewIcon(), t('settings-character-preview-tooltip'));
    }
    return result;
  });

  bcAeeModSdk.hookFunction('DialogMenuButtonBuild', 10, (args, next) => {
    const result = next(args);
    if (settings.hoverTryOn.get() && DialogMenuMode === 'items' && !DialogMenuButton.includes(DIALOG_HOVER_TRY_ON_BUTTON)) {
      const activityIndex = DialogMenuButton.indexOf('Activity');
      DialogMenuButton.splice(activityIndex >= 0 ? activityIndex : DialogMenuButton.length, 0, DIALOG_HOVER_TRY_ON_BUTTON);
    }
    if (settings.hairCharacterPreview.get() && DialogMenuMode === 'items' && !DialogMenuButton.includes(DIALOG_CHARACTER_PREVIEW_BUTTON)) {
      const activityIndex = DialogMenuButton.indexOf('Activity');
      DialogMenuButton.splice(activityIndex >= 0 ? activityIndex : DialogMenuButton.length, 0, DIALOG_CHARACTER_PREVIEW_BUTTON);
    }
    return result;
  });

  bcAeeModSdk.hookFunction('DialogClick', 10, (args, next) => {
    if (settings.hoverTryOn.get() && DialogMenuMode === 'items' && MouseIn(dialogHoverTryOnButtonX(), 15, 90, 90)) {
      toggleHoverTryOn();
      return;
    }
    if (settings.hairCharacterPreview.get() && DialogMenuMode === 'items' && MouseIn(dialogCharacterPreviewButtonX(), 15, 90, 90)) {
      toggleCharacterPreviewActive();
      return;
    }
    return next(args);
  });

  bcAeeModSdk.hookFunction('AppearancePreviewUseCharacter', 10, (args, next) => {
    const group = args[0];
    if (!group?.PreviewZone) return next(args);
    const isExtendedFaceGroup = EXTENDED_FACE_PREVIEW_GROUPS.has(group.Name as string);
    const isClothingGroup = group.Category === 'Appearance' && !!group.Clothing;
    if (isExtendedFaceGroup) {
      return true;
    }
    if (isClothingGroup && settings.characterPreviewActive.get()) {
      return true;
    }
    return next(args);
  });
}