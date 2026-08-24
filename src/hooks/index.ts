import {installRenderHooks} from '@/hooks/renderHooks';
import {installAppearanceHooks} from '@/hooks/appearanceHooks';
import {installItemColorHooks} from '@/hooks/itemColorHooks';
import {installMenuHooks} from '@/hooks/menuHooks';
import {installDragHandlers} from '@/controllers/dragController';
import {initializeViewBackground, installViewControlHandlers} from '@/controllers/viewController';
import {installSettingEffects, syncAfterBcRender} from '@/controllers/uiController';
import {initBcWheelScroll} from '@/hooks/bcWheelHooks';
import {installWardrobeHooks} from '@/hooks/wardrobeHooks';
import {installFontHooks} from '@/hooks/fontHooks';
import {initItemFonts} from '@/controllers/fontController';
import {installMaskSystem} from '@/components/mask-system';
import {installOnboarding} from '@/hooks/onboardingHooks';
import {installCanvasCorsHooks} from '@/hooks/canvasCorsHooks';
import {installHiddenArousalHook} from '@/hooks/hiddenArousalHook';
import {installDrawingHooks} from '@/hooks/drawingHooks';

export function installAeeHooks() {
  installCanvasCorsHooks();
  installHiddenArousalHook();
  installSettingEffects();
  installDrawingHooks();
  installRenderHooks();
  installAppearanceHooks();
  installItemColorHooks();
  installMenuHooks();
  installDragHandlers();
  installViewControlHandlers();
  initializeViewBackground();
  syncAfterBcRender();
  initBcWheelScroll();
  installWardrobeHooks();
  installFontHooks();
  initItemFonts();
  installMaskSystem();
  installOnboarding();
}
