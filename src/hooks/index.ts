import {installRenderHooks} from './renderHooks';
import {installAppearanceHooks} from './appearanceHooks';
import {installItemColorHooks} from './itemColorHooks';
import {installMenuHooks} from './menuHooks';
import {installDragHandlers} from '../controllers/dragController';
import {initializeViewBackground, installViewControlHandlers} from '../controllers/viewController';
import {syncAfterBcRender} from '../controllers/uiController';

export function installAeeHooks() {
  installRenderHooks();
  installAppearanceHooks();
  installItemColorHooks();
  installMenuHooks();
  installDragHandlers();
  installViewControlHandlers();
  initializeViewBackground();
  syncAfterBcRender();
}
