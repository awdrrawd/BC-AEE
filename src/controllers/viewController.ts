import {getCanvas} from '@/core/bc';
import {clamp} from '@/util/math';
import {getState, mutateState} from '@/core/store';
import {settings} from '@/core/settings';
import {getViewSettings} from '@/core/viewSettings';
import {runtime} from '@/core/runtime';
import {isInAppearanceScreen, updateAppearanceScreenState} from '@/core/appearanceScreenMachine';
import {
  loadBgImage,
  openBgSettings,
  saveBgAndRefresh,
  setBgEnabled,
  setBgImageEnabled,
  setGridEnabled
} from '@/controllers/backgroundController';

export function toggleCharControlOpen() {
  mutateState(draft => {
    const next = !draft.charControl.open;
    draft.charControl.open = next;
    // Collapsing the flyout should also collapse its sub-menus, so the
    // next time it opens it always starts from a fully-closed state
    // instead of remembering whichever sub-menu was left open.
    if (!next) {
      draft.charControl.bgSubOpen = false;
      draft.charControl.hideSubOpen = false;
    }
  });
}

export function toggleExpandDirection() {
  settings.ctrlExpandUp.toggle();
}

export function toggleSubDirection() {
  settings.ctrlSubLeft.toggle();
}

export function toggleBgSubOpen() {
  mutateState(draft => {
    draft.charControl.bgSubOpen = !draft.charControl.bgSubOpen;
  });
}

export function toggleHideSubOpen() {
  mutateState(draft => {
    draft.charControl.hideSubOpen = !draft.charControl.hideSubOpen;
  });
}

export function toggleOffsetPanel(open?: boolean) {
  mutateState(draft => {
    draft.offset.open = open ?? !draft.offset.open;
  });
}

export function moveOffsetPanel(left: number, top: number) {
  mutateState(draft => {
    draft.offset.left = left;
    draft.offset.top = top;
  });
}

export function setOffsetX(x: number) {
  getViewSettings().charOffsetX.set(clampOffsetX(x));
}

export function setOffsetY(y: number) {
  getViewSettings().charOffsetY.set(clampOffsetY(y));
}

export function setOffsetXY(x: number, y: number, persist = true) {
  const view = getViewSettings();
  view.charOffsetX.set(clampOffsetX(x), persist);
  view.charOffsetY.set(clampOffsetY(y), persist);
}

export function setCharScale(scale: number) {
  getViewSettings().charScale.set(clamp(scale, 0.1, 5));
}

function clampOffsetX(x: number) {
  return clamp(x, -700, 800);
}

function clampOffsetY(y: number) {
  return clamp(y, -2000, 2000);
}

export function resetOffset(kind: 'x' | 'y' | 'scale' | 'all') {
  if (kind === 'x' || kind === 'all') setOffsetX(0);
  if (kind === 'y' || kind === 'all') setOffsetY(0);
  if (kind === 'scale' || kind === 'all') setCharScale(1);
}

export function toggleOffsetCollapsed() {
  mutateState(draft => {
    draft.offset.collapsed = !draft.offset.collapsed;
  });
}

export function toggleWheelControl(enabled?: boolean) {
  mutateState(draft => {
    draft.offset.wheelControl = enabled ?? !draft.offset.wheelControl;
  });
}

export function togglePoseWindow(open?: boolean) {
  mutateState(draft => {
    draft.pose.open = open ?? !draft.pose.open;
  });
}

export function movePoseWindow(left: number, top: number) {
  mutateState(draft => {
    draft.pose.left = left;
    draft.pose.top = top;
  });
}

export const POSES: { name: AssetPoseName, labelKey: string }[] = [
  {name: 'BaseUpper', labelKey: 'pose-arms-relaxed'},
  {name: 'Yoked', labelKey: 'pose-hands-raised'},
  {name: 'OverTheHead', labelKey: 'pose-over-head'},
  {name: 'BackBoxTie', labelKey: 'pose-box-tie'},
  {name: 'BackElbowTouch', labelKey: 'pose-elbow-touch'},
  {name: 'BackCuffs', labelKey: 'pose-back-cuffs'},
  {name: 'BaseLower', labelKey: 'pose-standing'},
  {name: 'LegsClosed', labelKey: 'pose-legs-closed'},
  {name: 'Kneel', labelKey: 'pose-kneeling'},
  {name: 'KneelingSpread', labelKey: 'pose-kneeling-spread'},
  {name: 'AllFours', labelKey: 'pose-all-fours'},
];

export function getPoseIconUrl(name: string) {
  const href = window.location.href;
  return href.substring(0, href.lastIndexOf('/') + 1) + `Icons/Poses/${name}.png`;
}

export function applyPose(index: number) {
  const pose = POSES[index];
  if (!pose) return;
  const target = CharacterAppearanceSelection
    || (CurrentScreen === 'Crafting' ? CraftingPreview : null)
    || runtime.itemColorChar
    || Player;
  if (!target) return;
  try {
    CharacterSetActivePose(target, pose.name);
    CharacterRefresh(target);
    mutateState(draft => {
      draft.pose.activeIndex = index;
    });
  } catch {
    // Ignore pose errors for unsupported screens.
  }
}

export function toggleHide(kind: 'fullbody' | 'closeup') {
  const view = getViewSettings();
  if (kind === 'fullbody') view.hideFullbody.toggle();
  else view.hideCloseup.toggle();
}

export function toggleSolidBg() {
  setBgEnabled(!getViewSettings().bgEnabled.get());
}

export function toggleGridBg() {
  setGridEnabled(!getViewSettings().bgGridEnabled.get());
}

export function toggleImageBg() {
  const state = getState();
  const view = getViewSettings();
  if (!view.bgImgUrl.get()) {
    openBgSettings(true);
    return;
  }
  if (!state.bg.imageLoaded || runtime.bgImageUrl !== view.bgImgUrl.get()) loadBgImage(view.bgImgUrl.get());
  setBgImageEnabled(!view.bgImgEnabled.get());
}

let wheelHandlersInstalled = false;

function isViewControlScreen() {
  return isInAppearanceScreen() || CurrentScreen === 'Crafting' || !!runtime.itemColorChar;
}

function isWheelOverAeeUi(event: WheelEvent): boolean {
  const path = event.composedPath?.() ?? [];
  return path.some(node => node instanceof HTMLElement && node.dataset?.aeeRoot === 'true');
}

export function installViewControlHandlers() {
  if (wheelHandlersInstalled) return;
  wheelHandlersInstalled = true;
  let spaceDown = false;
  let wheelButtonDown = false;

  document.addEventListener('keydown', event => {
    const state = getState();
    updateAppearanceScreenState();
    if (!state.offset.wheelControl || !isViewControlScreen()) return;
    if (event.code === 'Space' && !event.repeat) {
      spaceDown = true;
      event.preventDefault();
    }
    if (event.ctrlKey && (event.code === 'Equal' || event.code === 'NumpadAdd')) {
      setCharScale(getViewSettings().charScale.get() + 0.05);
      event.preventDefault();
    }
    if (event.ctrlKey && (event.code === 'Minus' || event.code === 'NumpadSubtract')) {
      setCharScale(getViewSettings().charScale.get() - 0.05);
      event.preventDefault();
    }
  }, true);

  document.addEventListener('keyup', event => {
    if (event.code === 'Space') spaceDown = false;
  }, true);

  document.addEventListener('mousedown', event => {
    if (!getState().offset.wheelControl) return;
    if (event.button === 1) {
      wheelButtonDown = true;
      event.preventDefault();
    }
  }, true);

  document.addEventListener('mouseup', event => {
    if (event.button === 1) wheelButtonDown = false;
  }, true);

  document.addEventListener('mousemove', event => {
    const state = getState();
    updateAppearanceScreenState();
    if (!state.offset.wheelControl || !isViewControlScreen()) return;
    const dragging = wheelButtonDown || (spaceDown && event.buttons === 1);
    if (!dragging) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = (canvas.width || 2000) / rect.width;
    const view = getViewSettings();
    setOffsetX(view.charOffsetX.get() + Math.round(event.movementX * scale));
    setOffsetY(view.charOffsetY.get() + Math.round(event.movementY * scale));
  }, true);

  document.addEventListener('wheel', event => {
    const state = getState();
    updateAppearanceScreenState();
    if (!state.offset.wheelControl || !isViewControlScreen()) return;
    if (spaceDown || wheelButtonDown) return;
    if (isWheelOverAeeUi(event)) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    event.preventDefault();

    const view = getViewSettings();
    const oldScale = view.charScale.get();
    const nextScale = clamp(+(oldScale + (event.deltaY > 0 ? -0.05 : 0.05)).toFixed(2), 0.1, 5);
    if (nextScale === oldScale) return;
    const cw = canvas.width || 2000;
    const ch = canvas.height || 1000;
    const mouseCanvasX = (event.clientX - rect.left) / rect.width * cw;
    const mouseCanvasY = (event.clientY - rect.top) / rect.height * ch;
    const pivotX = mouseCanvasX - 500;
    const pivotY = mouseCanvasY;
    const ratio = nextScale / oldScale;
    setOffsetX(Math.round(pivotX + (view.charOffsetX.get() - pivotX) * ratio));
    setOffsetY(Math.round(pivotY + (view.charOffsetY.get() - pivotY) * ratio));
    setCharScale(nextScale);
  }, {passive: false});
}

export function initializeViewBackground() {
  const view = getViewSettings();
  if (view.bgImgEnabled.get() && view.bgImgUrl.get()) loadBgImage(view.bgImgUrl.get());
  if (view.bgEnabled.get() || view.bgGridEnabled.get()) saveBgAndRefresh();
}
