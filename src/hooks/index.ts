import {installRenderHooks} from '@/hooks/renderHooks';
import {installAppearanceHooks} from '@/hooks/appearanceHooks';
import {installItemColorHooks} from '@/hooks/itemColorHooks';
import {installMenuHooks} from '@/hooks/menuHooks';
import {installDragHandlers} from '@/controllers/dragController';
import {initializeViewBackground, installViewControlHandlers} from '@/controllers/viewController';
import {syncAfterBcRender} from '@/controllers/uiController';
import {initBcWheelScroll} from '@/hooks/bcWheelHooks';

export function installAeeHooks() {
  installRenderHooks();
  installAppearanceHooks();
  installItemColorHooks();
  installMenuHooks();
  installDragHandlers();
  installViewControlHandlers();
  initializeViewBackground();
  syncAfterBcRender();
  initBcWheelScroll();
}
