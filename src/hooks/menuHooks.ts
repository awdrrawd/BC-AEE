import bcAeeModSdk from '@/modsdk';
import {getState} from '@/core/store';
import {exportBcxAppearance, importBcxAppearanceWithCategory, importBcxFromText} from '@/controllers/importExportController';
import {isInAppearanceScreen} from '@/core/appearanceScreenMachine';
import {t} from '@/i18n/i18n';

// Don't hijack a paste when the user is pasting into a real text field.
function isEditablePasteTarget(event: ClipboardEvent): boolean {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable) return true;
  }
  return false;
}

export function installMenuHooks() {
  // Ctrl+V on the dressing-room screen imports directly from the paste event -
  // no clipboard-read permission popup, no user-activation requirement. Gated
  // by the pasteImport setting. The button (readText) stays as the fallback.
  document.addEventListener('paste', event => {
    if (!getState().pasteImport) return;
    if (typeof CharacterAppearanceMode === 'undefined' || CharacterAppearanceMode !== '') return;
    if (!isInAppearanceScreen()) return;
    if (isEditablePasteTarget(event)) return;
    const character = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
    if (!character) return;
    const text = event.clipboardData?.getData('text')?.trim();
    if (!text) return;
    event.preventDefault();
    importBcxFromText(character, text);
  });

  bcAeeModSdk.hookFunction('AppearanceMenuBuild', 10, (args, next) => {
    next(args);
    if (!getState().enableAeeMenu) return;
    if (typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode !== '') return;
    AppearanceMenu = AppearanceMenu.filter((button) => button !== 'WearRandom' && button !== 'Random');
    AppearanceMenu = AppearanceMenu.map((button) => {
      if (button === 'Copy') return 'AEE_Export';
      if (button === 'Paste') return 'AEE_Import';
      return button;
    });
    // When editing another character's appearance there are no Copy/Paste
    // buttons to replace, so add our buttons. Prepend so they sit on the left
    // (Import leftmost) rather than at the far right of the menu.
    if (!AppearanceMenu.includes('AEE_Export')) AppearanceMenu.unshift('AEE_Export');
    if (!AppearanceMenu.includes('AEE_Import')) AppearanceMenu.unshift('AEE_Import');
    if (typeof TextGet === 'function' && typeof TextCache !== 'undefined') {
      try {
        TextCache.Text_Appearance = TextCache.Text_Appearance || {};
        TextCache.Text_Appearance.AEE_Export = t('menu-export-label');
        TextCache.Text_Appearance.AEE_Import = t('menu-import-label');
      } catch {
        // ignore
      }
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuDraw', 10, (args, next) => {
    next(args);
    if (!getState().enableAeeMenu) return;
    const menu = AppearanceMenu;
    const x = 2000 - menu.length * 117;
    for (let index = 0; index < menu.length; index++) {
      const buttonX = x + 117 * index;
      if (menu[index] === 'AEE_Export') {
        DrawButton(buttonX, 25, 90, 90, '', 'White', 'Icons/Copy.png', t('menu-export-tooltip'));
      }
      if (menu[index] === 'AEE_Import') {
        DrawButton(buttonX, 25, 90, 90, '', 'White', 'Icons/Paste.png', t('menu-import-tooltip'));
      }
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuClick', 10, (args, next) => {
    const x = 2000 - AppearanceMenu.length * 117;
    for (let index = 0; index < AppearanceMenu.length; index++) {
      if (!MouseXIn(x + 117 * index, 90)) continue;
      if (AppearanceMenu[index] === 'AEE_Export') {
        exportBcxAppearance(CharacterAppearanceSelection);
        return;
      }
      if (AppearanceMenu[index] === 'AEE_Import') {
        importBcxAppearanceWithCategory(CharacterAppearanceSelection);
        return;
      }
    }
    return next(args);
  });
}
