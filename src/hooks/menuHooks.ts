import bcAeeModSdk from '@/modsdk';
import {getState} from '@/core/store';
import {exportBcxAppearance, importBcxAppearanceWithCategory} from '@/controllers/importExportController';
import {isZh} from '@/core/lang';

export function installMenuHooks() {
  bcAeeModSdk.hookFunction('AppearanceMenuBuild', 10, (args, next) => {
    next(args);
    if (!getState().enableAeeMenu) return;
    if (typeof CharacterAppearanceMode === 'undefined' || CharacterAppearanceMode !== '') return;
    AppearanceMenu = AppearanceMenu.filter((button) => button !== 'WearRandom' && button !== 'Random');
    AppearanceMenu = AppearanceMenu.map((button) => {
      if (button === 'Copy') return 'AEE_Export';
      if (button === 'Paste') return 'AEE_Import';
      return button;
    });
    if (typeof TextGet === 'function' && typeof TextCache !== 'undefined') {
      try {
        TextCache.Text_Appearance = TextCache.Text_Appearance || {};
        TextCache.Text_Appearance.AEE_Export = isZh() ? 'BCX匯出' : 'Export';
        TextCache.Text_Appearance.AEE_Import = isZh() ? 'BCX匯入' : 'Import';
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
        DrawButton?.(buttonX, 25, 90, 90, '', 'White', 'Icons/Copy.png', isZh() ? 'BCX 匯出外觀至剪貼板' : 'BCX Export appearance to clipboard');
      }
      if (menu[index] === 'AEE_Import') {
        DrawButton?.(buttonX, 25, 90, 90, '', 'White', 'Icons/Paste.png', isZh() ? 'BCX 匯入外觀（選擇種類）' : 'BCX Import appearance (select categories)');
      }
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuClick', 10, (args, next) => {
    const x = 2000 - AppearanceMenu.length * 117;
    for (let index = 0; index < AppearanceMenu.length; index++) {
      if (!MouseXIn?.(x + 117 * index, 90)) continue;
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
