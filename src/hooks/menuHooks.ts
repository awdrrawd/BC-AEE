import bcAeeModSdk from '@/modsdk';

import {importBcxFromText} from '@/controllers/importExportController';
import {clearCopyBuffer, drawCopyBufferPreview, isAppearanceOverlayActive, isCopyActive} from '@/controllers/copyPasteController';
import {CLEAR_ICON} from '@/controllers/copyPasteIcons';
import {isInAppearanceScreen} from '@/core/appearanceScreenMachine';
import {cyclePartsFilterMode, drawPartsFilterBadge, partsFilterTooltip} from '@/controllers/partsFilterController';
import {layerManagerTooltip, openLayerManagerPanel} from '@/controllers/layerManagerController';
import {hideRestraintsTooltip, isHideRestraintsActive, toggleHideRestraints} from '@/controllers/hideRestraintsController';
import {t} from '@/i18n/i18n';
import {enterWardrobeScreen} from '@/hooks/wardrobeHooks';
import {settings} from '@/core/settings';
import {isHoverTryOnEnabled, toggleHoverTryOn, toggleCharacterPreviewActive} from '@/controllers/uiController';
import {GAME_ICONS} from '@/components/icons/iconSources';

const HOVER_TRY_ON_BUTTON = 'AEE_HoverTryOn';
const DIALOG_HOVER_TRY_ON_BUTTON = 'AEE_HoverTryOn' as DialogMenuButtonType;
const CHARACTER_PREVIEW_BUTTON = 'AEE_CharacterPreview';

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

function hoverTryOnIcon(scope: 'clothing' | 'item'): string {
  return isHoverTryOnEnabled(scope) ? GAME_ICONS.public : GAME_ICONS.private;
}

function characterPreviewIcon(): string {
  return settings.characterPreviewActive.get() ? GAME_ICONS.character : GAME_ICONS.characterOff;
}

/** BC lays this menu out from the end, so inserting these controls at the
 * beginning places them at the visual end for both self and other characters. */
export function injectClothingPreviewButtons(menu: typeof AppearanceMenu, hoverTryOn: boolean, characterPreview: boolean) {
  let insertIndex = 0;
  if (hoverTryOn && !menu.includes(HOVER_TRY_ON_BUTTON)) {
    menu.splice(insertIndex++, 0, HOVER_TRY_ON_BUTTON);
  }
  if (characterPreview && !menu.includes(CHARACTER_PREVIEW_BUTTON)) {
    menu.splice(insertIndex, 0, CHARACTER_PREVIEW_BUTTON);
  }
}

function dialogHoverTryOnButtonX(): number {
  const index = DialogMenuButton.indexOf(DIALOG_HOVER_TRY_ON_BUTTON);
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
    if (CharacterAppearanceMode === 'Cloth') {
      injectClothingPreviewButtons(AppearanceMenu, settings.hoverTryOn.get(), settings.hairCharacterPreview.get());
    }
    if (settings.hideUnnecessaryAppearanceButtons.get()) {
      const hidden = new Set(['WearRandom', 'Random', 'Copy', 'Paste']);
      AppearanceMenu = AppearanceMenu.filter(button => !hidden.has(button));
    }
    if (CharacterAppearanceMode !== '') return;
    // Appearance management actions now live in the DOM side toolbar. Keep
    // BC's native top menu untouched so those five AEE buttons are not added.
    if (settings.enableCopyPaste.get() && isCopyActive() && !isAppearanceOverlayActive() && !AppearanceMenu.includes('AEE_ClearCopy')) {
      AppearanceMenu.unshift('AEE_ClearCopy');
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuDraw', 10, (args, next) => {
    const menu = AppearanceMenu;
    const clearCopyIndex = menu.indexOf('AEE_ClearCopy');
    const partsFilterIndex = menu.indexOf('AEE_PartsFilter');
    const hideRestraintsIndex = menu.indexOf('AEE_HideRestraints');
    const layerManagerIndex = menu.indexOf('AEE_LayerManager');
    const hoverTryOnIndex = menu.indexOf(HOVER_TRY_ON_BUTTON);
    const charPreviewIndex = menu.indexOf(CHARACTER_PREVIEW_BUTTON);
    if (clearCopyIndex < 0 && partsFilterIndex < 0 && hideRestraintsIndex < 0 && layerManagerIndex < 0 && hoverTryOnIndex < 0 && charPreviewIndex < 0) {
      next(args);
    } else {
      AppearanceMenu = menu.map((button, index) =>
        (index === clearCopyIndex || index === partsFilterIndex || index === hideRestraintsIndex || index === layerManagerIndex || index === hoverTryOnIndex || index === charPreviewIndex ? 'Copy' : button));
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
      DrawButton(hideRestraintsX, 25, 90, 90, '', isHideRestraintsActive() ? '#FFB0B0' : 'White', GAME_ICONS.hideRestraints, hideRestraintsTooltip());
    }
    if (layerManagerIndex >= 0 && !isAppearanceOverlayActive()) {
      const layerManagerX = x + 117 * layerManagerIndex;
      DrawButton(layerManagerX, 25, 90, 90, '', 'White', GAME_ICONS.layering, layerManagerTooltip());
    }
    if (partsFilterIndex >= 0 && !isAppearanceOverlayActive()) {
      const partsFilterX = x + 117 * partsFilterIndex;
      DrawButton(partsFilterX, 25, 90, 90, '', 'White', GAME_ICONS.dress, partsFilterTooltip());
      drawPartsFilterBadge(partsFilterX, 25);
    }
    if (hoverTryOnIndex >= 0 && !isAppearanceOverlayActive()) {
      DrawButton(x + 117 * hoverTryOnIndex, 25, 90, 90, '', 'White', hoverTryOnIcon('clothing'), t('settings-hover-tryon-tooltip'));
    }
    if (charPreviewIndex >= 0 && !isAppearanceOverlayActive()) {
      DrawButton(x + 117 * charPreviewIndex, 25, 90, 90, '', 'White', characterPreviewIcon(), t('settings-character-preview-tooltip'));
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
      if (AppearanceMenu[index] === 'AEE_LayerManager' && !isAppearanceOverlayActive()) {
        openLayerManagerPanel();
        return;
      }
      if (AppearanceMenu[index] === HOVER_TRY_ON_BUTTON && !isAppearanceOverlayActive()) {
        toggleHoverTryOn('clothing');
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
    if (hoverTryOnIndex >= 0) {
      DialogMenuButton = menu.map((button, index) => index === hoverTryOnIndex ? 'Exit' : button);
    }
    let result: ReturnType<typeof next>;
    try {
      result = next(args);
    } finally {
      DialogMenuButton = menu;
    }
    if (hoverTryOnIndex >= 0 && settings.hoverTryOn.get() && DialogMenuMode === 'items') {
      DrawButton(dialogHoverTryOnButtonX(), 15, 90, 90, '', 'White', hoverTryOnIcon('item'), t('settings-hover-tryon-tooltip'));
    }
    return result;
  });

  bcAeeModSdk.hookFunction('DialogMenuButtonBuild', 10, (args, next) => {
    const result = next(args);
    if (settings.hoverTryOn.get() && DialogMenuMode === 'items' && !DialogMenuButton.includes(DIALOG_HOVER_TRY_ON_BUTTON)) {
      const activityIndex = DialogMenuButton.indexOf('Activity');
      DialogMenuButton.splice(activityIndex >= 0 ? activityIndex : DialogMenuButton.length, 0, DIALOG_HOVER_TRY_ON_BUTTON);
    }
    return result;
  });

  bcAeeModSdk.hookFunction('DialogClick', 10, (args, next) => {
    if (settings.hoverTryOn.get() && DialogMenuMode === 'items' && MouseIn(dialogHoverTryOnButtonX(), 15, 90, 90)) {
      toggleHoverTryOn('item');
      return;
    }
    return next(args);
  });

  bcAeeModSdk.hookFunction('AppearancePreviewUseCharacter', 10, (args, next) => {
    // Leave BC's native Character/CharacterOff toggle authoritative unless the
    // AEE replacement preview control is enabled. Otherwise the always-on face
    // previews below would force characters to remain visible after BC's native
    // toggle has been switched off.
    if (!settings.hairCharacterPreview.get()) return next(args);
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
