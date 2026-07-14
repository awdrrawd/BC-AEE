import bcAeeModSdk from '@/modsdk';

import {exportBcxAppearance, importBcxAppearanceWithCategory, importBcxFromText} from '@/controllers/importExportController';
import {clearCopyBuffer, drawCopyBufferPreview, isAppearanceOverlayActive, isCopyActive} from '@/controllers/copyPasteController';
import {CLEAR_ICON} from '@/controllers/copyPasteIcons';
import {isInAppearanceScreen} from '@/core/appearanceScreenMachine';
import {cyclePartsFilterMode, drawPartsFilterBadge, isPartsFilterAvailable, partsFilterIcon, partsFilterTooltip} from '@/controllers/partsFilterController';
import {t} from '@/i18n/i18n';
import {enterWardrobeScreen} from '@/hooks/wardrobeHooks';
import {settings} from '@/core/settings';

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
    importBcxFromText(character, text);
  });

  bcAeeModSdk.hookFunction('AppearanceMenuBuild', 10, (args, next) => {
    next(args);
    if (CharacterAppearanceMode !== '') return;
    if (settings.enableAeeMenu.get()) {
      AppearanceMenu = AppearanceMenu.filter((button) => button !== 'WearRandom' && button !== 'Random');
      AppearanceMenu = AppearanceMenu.filter((button) => button !== 'Copy' && button !== 'Paste');
      const wardrobeIndex = AppearanceMenu.findIndex((button) => button === 'Wardrobe' || button === 'WardrobeDisabled');
      if (wardrobeIndex >= 0) AppearanceMenu.splice(wardrobeIndex + 1, 0, 'Copy', 'Paste');
      else AppearanceMenu.unshift('Copy', 'Paste');
    }
    if (settings.enableCopyPaste.get() && isCopyActive() && !isAppearanceOverlayActive() && !AppearanceMenu.includes('AEE_ClearCopy')) {
      AppearanceMenu.unshift('AEE_ClearCopy');
    }
    if (isPartsFilterAvailable() && !AppearanceMenu.includes('AEE_PartsFilter')) {
      AppearanceMenu.unshift('AEE_PartsFilter');
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuDraw', 10, (args, next) => {
    const menu = AppearanceMenu;
    const clearCopyIndex = menu.indexOf('AEE_ClearCopy');
    const partsFilterIndex = menu.indexOf('AEE_PartsFilter');
    if (clearCopyIndex < 0 && partsFilterIndex < 0) {
      next(args);
    } else {
      AppearanceMenu = menu.map((button, index) => (index === clearCopyIndex || index === partsFilterIndex ? 'Copy' : button));
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
    if (partsFilterIndex >= 0 && !isAppearanceOverlayActive()) {
      const partsFilterX = x + 117 * partsFilterIndex;
      DrawButton(partsFilterX, 25, 90, 90, '', 'White', partsFilterIcon(), partsFilterTooltip());
      drawPartsFilterBadge(partsFilterX, 25);
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
    }
    return next(args);
  });
}
