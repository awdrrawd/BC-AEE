import {settings} from '@/core/settings';

export type ViewSettingsContext = 'appearance' | 'item' | 'crafting';

export function getViewSettingsContext(): ViewSettingsContext {
  if (CurrentScreen === 'Crafting') return 'crafting';
  if (CurrentScreen === 'Appearance') return 'appearance';
  return 'item';
}

export function getViewSettings() {
  const appearanceBackground = {
    bgEnabled: settings.bgEnabled,
    bgColor: settings.bgColor,
    bgGridEnabled: settings.bgGridEnabled,
    bgGridMode: settings.bgGridMode,
    bgGridPx: settings.bgGridPx,
    bgGridColor: settings.bgGridColor,
    bgGridOpacity: settings.bgGridOpacity,
    bgGridLayer: settings.bgGridLayer,
    bgImgEnabled: settings.bgImgEnabled,
    bgImgUrl: settings.bgImgUrl,
  };
  switch (getViewSettingsContext()) {
    case 'crafting':
      return {
        hideCloseup: settings.craftingHideCloseup,
        hideFullbody: settings.craftingHideFullbody,
        charOffsetX: settings.craftingCharOffsetX,
        charOffsetY: settings.craftingCharOffsetY,
        charScale: settings.craftingCharScale,
        bgEnabled: settings.craftingBgEnabled,
        bgColor: settings.craftingBgColor,
        bgGridEnabled: settings.craftingBgGridEnabled,
        bgGridMode: settings.craftingBgGridMode,
        bgGridPx: settings.craftingBgGridPx,
        bgGridColor: settings.craftingBgGridColor,
        bgGridOpacity: settings.craftingBgGridOpacity,
        bgGridLayer: settings.craftingBgGridLayer,
        bgImgEnabled: settings.craftingBgImgEnabled,
        bgImgUrl: settings.craftingBgImgUrl,
      };
    case 'item':
      return {
        hideCloseup: settings.itemHideCloseup,
        hideFullbody: settings.itemHideFullbody,
        charOffsetX: settings.itemCharOffsetX,
        charOffsetY: settings.itemCharOffsetY,
        charScale: settings.itemCharScale,
        ...appearanceBackground,
      };
    default:
      return {
        hideCloseup: settings.hideCloseup,
        hideFullbody: settings.hideFullbody,
        charOffsetX: settings.charOffsetX,
        charOffsetY: settings.charOffsetY,
        charScale: settings.charScale,
        ...appearanceBackground,
      };
  }
}

export function getLayerPickerSetting() {
  switch (getViewSettingsContext()) {
    case 'crafting': return settings.craftingLayerPickerMode;
    case 'item': return settings.itemLayerPickerMode;
    default: return settings.layerPickerMode;
  }
}
