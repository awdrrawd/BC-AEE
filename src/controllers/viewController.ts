import {getCanvas, getCanvasRect} from '@/core/bc';
import {clamp} from '@/util/math';
import {getState, mutateState} from '@/core/store';
import {settings} from '@/core/settings';
import {isInAppearanceScreen, updateAppearanceScreenState} from '@/core/appearanceScreenMachine';
import {
  loadBgImage,
  openBgSettings,
  saveBgAndRefresh,
  setBgEnabled,
  setBgImageEnabled,
  setGridEnabled
} from '@/controllers/backgroundController';

export const CTRL_BTN_SIZE = 52;

export function assetUrl(path: string) {
  const url = new URL(import.meta.url);
  url.pathname = url.pathname.replace(/\/assets\/[^/]+$/, `/${path.replace(/^\//, '')}`);
  return url.toString();
}

export const CTRL_ICON_MAIN = assetUrl('AEE_ICON.png');
export const CTRL_ICON_FRAME = assetUrl('AEE_ICON2.png');

export function showCharControl() {
  mutateState(draft => {
    draft.charControl.visible = true;
  });
  alignCharControl();
}

export function hideCharControl() {
  mutateState(draft => {
    draft.charControl.visible = false;
    draft.charControl.open = false;
    draft.offset.open = false;
    draft.pose.open = false;
    draft.bg.settingsOpen = false;
  });
}

export function toggleCharControlOpen() {
  mutateState(draft => {
    draft.charControl.open = !draft.charControl.open;
  });
}

export function moveCharControl(left: number, top: number, persist = true) {
  const rect = getCanvasRect();
  let nextLeft = left;
  let nextTop = top;
  if (rect) {
    nextLeft = clamp(left, 0, rect.width - CTRL_BTN_SIZE);
    nextTop = clamp(top, 0, rect.height - CTRL_BTN_SIZE);
  }
  settings.charCtrlPos.set({left: nextLeft, top: nextTop}, persist);
  mutateState(draft => {
    draft.charControl.left = nextLeft;
    draft.charControl.top = nextTop;
  });
}

export function commitCharControlPos() {
  const {left, top} = getState().charControl;
  if (left != null && top != null) settings.charCtrlPos.set({left, top});
}

export function alignCharControl() {
  const rect = getCanvasRect();
  if (!rect) return;
  const state = getState();
  if (state.charControl.left != null && state.charControl.top != null) {
    moveCharControl(state.charControl.left, state.charControl.top);
  } else {
    mutateState(draft => {
      draft.charControl.left = rect.width * 0.01;
      draft.charControl.top = rect.height * 0.87;
    });
  }
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
  settings.charOffsetX.set(clampOffsetX(x));
}

export function setOffsetY(y: number) {
  settings.charOffsetY.set(clampOffsetY(y));
}

export function setOffsetXY(x: number, y: number, persist = true) {
  settings.charOffsetX.set(clampOffsetX(x), persist);
  settings.charOffsetY.set(clampOffsetY(y), persist);
}

export function setCharScale(scale: number) {
  settings.charScale.set(clamp(scale, 0.1, 5));
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
  const target = CharacterAppearanceSelection || Player;
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
  if (kind === 'fullbody') settings.hideFullbody.toggle();
  else settings.hideCloseup.toggle();
}

export function toggleSolidBg() {
  setBgEnabled(!settings.bgEnabled.get());
}

export function toggleGridBg() {
  setGridEnabled(!settings.bgGridEnabled.get());
}

export function toggleImageBg() {
  const state = getState();
  if (!settings.bgImgUrl.get()) {
    openBgSettings(true);
    return;
  }
  if (!state.bg.imageLoaded) loadBgImage(settings.bgImgUrl.get());
  setBgImageEnabled(!settings.bgImgEnabled.get());
}

let wheelHandlersInstalled = false;

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
    if (!state.offset.wheelControl || !isInAppearanceScreen()) return;
    if (event.code === 'Space' && !event.repeat) {
      spaceDown = true;
      event.preventDefault();
    }
    if (event.ctrlKey && (event.code === 'Equal' || event.code === 'NumpadAdd')) {
      setCharScale(settings.charScale.get() + 0.05);
      event.preventDefault();
    }
    if (event.ctrlKey && (event.code === 'Minus' || event.code === 'NumpadSubtract')) {
      setCharScale(settings.charScale.get() - 0.05);
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
    if (!state.offset.wheelControl || !isInAppearanceScreen()) return;
    const dragging = wheelButtonDown || (spaceDown && event.buttons === 1);
    if (!dragging) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = (canvas.width || 2000) / rect.width;
    setOffsetX(settings.charOffsetX.get() + Math.round(event.movementX * scale));
    setOffsetY(settings.charOffsetY.get() + Math.round(event.movementY * scale));
  }, true);

  document.addEventListener('wheel', event => {
    const state = getState();
    updateAppearanceScreenState();
    if (!state.offset.wheelControl || !isInAppearanceScreen()) return;
    if (spaceDown || wheelButtonDown) return;
    if (isWheelOverAeeUi(event)) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    event.preventDefault();

    const oldScale = settings.charScale.get();
    const nextScale = clamp(+(oldScale + (event.deltaY > 0 ? -0.05 : 0.05)).toFixed(2), 0.1, 5);
    if (nextScale === oldScale) return;
    const cw = canvas.width || 2000;
    const ch = canvas.height || 1000;
    const mouseCanvasX = (event.clientX - rect.left) / rect.width * cw;
    const mouseCanvasY = (event.clientY - rect.top) / rect.height * ch;
    const pivotX = mouseCanvasX - 500;
    const pivotY = mouseCanvasY;
    const ratio = nextScale / oldScale;
    setOffsetX(Math.round(pivotX + (settings.charOffsetX.get() - pivotX) * ratio));
    setOffsetY(Math.round(pivotY + (settings.charOffsetY.get() - pivotY) * ratio));
    setCharScale(nextScale);
  }, {passive: false});
}

export function initializeViewBackground() {
  if (settings.bgImgEnabled.get() && settings.bgImgUrl.get()) loadBgImage(settings.bgImgUrl.get());
  if (settings.bgEnabled.get() || settings.bgGridEnabled.get()) saveBgAndRefresh();
}
