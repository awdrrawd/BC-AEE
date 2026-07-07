import bcAeeModSdk from '@/modsdk';
import {getState} from '@/core/store';
import {exportBcxAppearance, importBcxAppearanceWithCategory, importBcxFromText} from '@/controllers/importExportController';
import {clearCopyBuffer, drawCopyBufferPreview, isAppearanceOverlayActive, isCopyActive} from '@/controllers/copyPasteController';
import {CLEAR_ICON} from '@/controllers/copyPasteIcons';
import {isInAppearanceScreen} from '@/core/appearanceScreenMachine';
import {cyclePartsFilterMode, drawPartsFilterBadge, isPartsFilterAvailable, partsFilterIcon, partsFilterTooltip} from '@/controllers/partsFilterController';
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
    if (typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode !== '') return;
    const state = getState();
    if (state.enableAeeMenu) {
      AppearanceMenu = AppearanceMenu.filter((button) => button !== 'WearRandom' && button !== 'Random');
      // Reuse BC's own 'Copy'/'Paste' button names instead of inventing new
      // ones. AppearanceMenuDraw resolves an icon straight from the button
      // name for anything it doesn't recognize, so a made-up name like
      // 'AEE_Export' makes it fire a doomed GET for Icons/AEE_Export.png
      // before we ever get a chance to draw over it. 'Copy'/'Paste' are
      // names BC already knows how to draw (Icons/Copy.png, Icons/Paste.png),
      // so the icon comes for free and never 404s. We still repaint just the
      // tooltip for these two in AppearanceMenuDraw below (see there for why
      // mutating TextCache isn't reliable enough on its own), and repurpose
      // their click behavior in AppearanceMenuClick.
      AppearanceMenu = AppearanceMenu.filter((button) => button !== 'Copy' && button !== 'Paste');
      // Keep a consistent left-to-right order whether editing our own appearance
      // (BC gives us Copy/Paste to replace, ending up after Wardrobe) or someone
      // else's (no such buttons): always Wardrobe, then Export, then Import. Pull
      // our two buttons out and re-place them right after the Wardrobe button so
      // both cases match.
      const wardrobeIndex = AppearanceMenu.findIndex((button) => button === 'Wardrobe' || button === 'WardrobeDisabled');
      if (wardrobeIndex >= 0) AppearanceMenu.splice(wardrobeIndex + 1, 0, 'Copy', 'Paste');
      else AppearanceMenu.unshift('Copy', 'Paste');
    }
    // Show a Clear button (to drop the copy state) while a copy is active. It is
    // rebuilt on demand from the copy/paste controller when the state changes.
    if (state.enableCopyPaste && isCopyActive() && !isAppearanceOverlayActive() && !AppearanceMenu.includes('AEE_ClearCopy')) {
      AppearanceMenu.unshift('AEE_ClearCopy');
    }
    // Body-part filter toggle - only makes sense on the groups list itself
    // (guaranteed by the mode==='' guard above), never in Wardrobe/Cloth/
    // Color/Permissions sub-screens.
    if (isPartsFilterAvailable() && !AppearanceMenu.includes('AEE_PartsFilter')) {
      AppearanceMenu.unshift('AEE_PartsFilter');
    }
  });

  bcAeeModSdk.hookFunction('AppearanceMenuDraw', 10, (args, next) => {
    const state = getState();
    const menu = AppearanceMenu;
    const clearCopyIndex = menu.indexOf('AEE_ClearCopy');
    const partsFilterIndex = menu.indexOf('AEE_PartsFilter');
    if (clearCopyIndex < 0 && partsFilterIndex < 0) {
      // Nothing custom left to hide - Copy/Paste are real BC names now, so
      // let BC draw the whole row itself.
      next(args);
    } else {
      // Neither 'AEE_ClearCopy' nor 'AEE_PartsFilter' has a BC equivalent, so
      // the native draw would try (and fail) to fetch an icon for them.
      // Rather than removing them from the array - which would shrink
      // AppearanceMenu.length and shift every other button's x position out
      // of sync with our own layout math below - swap in a name BC already
      // knows how to draw ('Copy', which is also almost always already
      // loaded/cached by this point). BC draws a real, valid icon in that
      // slot instead of failing, then we immediately paint over it with the
      // real icon for each.
      AppearanceMenu = menu.map((button, index) => (index === clearCopyIndex || index === partsFilterIndex ? 'Copy' : button));
      try {
        next(args);
      } finally {
        AppearanceMenu = menu;
      }
    }
    const x = 2000 - menu.length * 117;
    if (clearCopyIndex >= 0 && !isAppearanceOverlayActive()) {
      // Draw the button itself first (border, hover feedback, tooltip) with
      // no icon of its own, then overlay a same-size thumbnail of whatever
      // is actually in the copy buffer so it's obvious at a glance what will
      // be pasted; drawCopyBufferPreview falls back to the plain clear icon
      // if a preview can't be drawn for some reason.
      const clearCopyX = x + 117 * clearCopyIndex;
      DrawButton(clearCopyX, 25, 90, 90, '', 'White', null, t('copy-cancel-tooltip'));
      drawCopyBufferPreview(clearCopyX, 25, 90, CharacterAppearanceSelection ?? null, CLEAR_ICON);
    }
    if (partsFilterIndex >= 0 && !isAppearanceOverlayActive()) {
      const partsFilterX = x + 117 * partsFilterIndex;
      DrawButton(partsFilterX, 25, 90, 90, '', 'White', partsFilterIcon(), partsFilterTooltip());
      drawPartsFilterBadge(partsFilterX, 25);
    }
    if (state.enableAeeMenu) {
      // The icon draws fine straight from BC's native pass above (real
      // files, no 404), but the hover tooltip for a recognized name like
      // 'Copy'/'Paste' is populated by BC's own text-loading flow, which can
      // (re)write TextCache.Text_Appearance.Copy/Paste after we do - so
      // setting it ourselves ahead of time isn't reliable. Passing our text
      // straight into DrawButton's tooltip argument here always wins,
      // because it paints the tooltip synchronously as part of this call
      // rather than depending on whatever BC's cache holds by the time the
      // hover is rendered.
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
    const state = getState();
    const x = 2000 - AppearanceMenu.length * 117;
    for (let index = 0; index < AppearanceMenu.length; index++) {
      if (!MouseXIn(x + 117 * index, 90)) continue;
      if (state.enableAeeMenu && AppearanceMenu[index] === 'Copy') {
        exportBcxAppearance(CharacterAppearanceSelection);
        return;
      }
      if (state.enableAeeMenu && AppearanceMenu[index] === 'Paste') {
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