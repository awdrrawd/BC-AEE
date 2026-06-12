import {getCanvas, getCanvasRect} from '@/core/bc';
import {getState, mutateState} from '@/core/store';
import {setAeeSetting} from '@/core/settings';
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

export function moveCharControl(left: number, top: number) {
  const rect = getCanvasRect();
  let nextLeft = left;
  let nextTop = top;
  if (rect) {
    nextLeft = Math.max(0, Math.min(rect.width - CTRL_BTN_SIZE, left));
    nextTop = Math.max(0, Math.min(rect.height - CTRL_BTN_SIZE, top));
  }
  setAeeSetting('charCtrlPos', {left: nextLeft, top: nextTop});
  mutateState(draft => {
    draft.charControl.left = nextLeft;
    draft.charControl.top = nextTop;
  });
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
  mutateState(draft => {
    draft.charControl.expandUp = !draft.charControl.expandUp;
    setAeeSetting('ctrlExpandUp', draft.charControl.expandUp);
  });
}

export function toggleSubDirection() {
  mutateState(draft => {
    draft.charControl.subLeft = !draft.charControl.subLeft;
    setAeeSetting('ctrlSubLeft', draft.charControl.subLeft);
  });
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
  const clamped = clampOffsetX(x);
  setAeeSetting('charOffsetX', clamped);
  mutateState(draft => {
    draft.offset.x = clamped;
  });
}

export function setOffsetY(y: number) {
  const clamped = clampOffsetY(y);
  setAeeSetting('charOffsetY', clamped);
  mutateState(draft => {
    draft.offset.y = clamped;
  });
}

export function setOffsetXY(x: number, y: number, persist = true) {
  const clampedX = clampOffsetX(x);
  const clampedY = clampOffsetY(y);
  if (persist) {
    setAeeSetting('charOffsetX', clampedX);
    setAeeSetting('charOffsetY', clampedY);
  }
  mutateState(draft => {
    draft.offset.x = clampedX;
    draft.offset.y = clampedY;
  });
}

export function setCharScale(scale: number) {
  const clamped = Math.max(0.1, Math.min(5, scale));
  setAeeSetting('charScale', clamped);
  mutateState(draft => {
    draft.offset.scale = clamped;
  });
}

function clampOffsetX(x: number) {
  return Math.max(-700, Math.min(800, x));
}

function clampOffsetY(y: number) {
  return Math.max(-2000, Math.min(2000, y));
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

export const POSES: { name: AssetPoseName, zh: string, en: string }[] = [
  {name: 'BaseUpper', zh: '放鬆手臂', en: 'Arms Relaxed'},
  {name: 'Yoked', zh: '高舉雙手', en: 'Hands Raised'},
  {name: 'OverTheHead', zh: '雙手過頭', en: 'Over Head'},
  {name: 'BackBoxTie', zh: '反綁雙手', en: 'Box Tie'},
  {name: 'BackElbowTouch', zh: '肘部相觸', en: 'Elbow Touch'},
  {name: 'BackCuffs', zh: '右手反抓', en: 'Back Cuffs'},
  {name: 'BaseLower', zh: '站立', en: 'Standing'},
  {name: 'LegsClosed', zh: '併腿', en: 'Legs Closed'},
  {name: 'Kneel', zh: '跪下', en: 'Kneeling'},
  {name: 'KneelingSpread', zh: '跪姿分腿', en: 'Kneeling Spread'},
  {name: 'AllFours', zh: '趴跪', en: 'All Fours'},
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
  mutateState(draft => {
    if (kind === 'fullbody') {
      draft.hideFullbody = !draft.hideFullbody;
      setAeeSetting('hideFullbody', draft.hideFullbody);
    } else {
      draft.hideCloseup = !draft.hideCloseup;
      setAeeSetting('hideCloseup', draft.hideCloseup);
    }
  });
}

export function toggleSolidBg() {
  setBgEnabled(!getState().bg.enabled);
}

export function toggleGridBg() {
  setGridEnabled(!getState().bg.gridEnabled);
}

export function toggleImageBg() {
  const state = getState();
  if (!state.bg.imageUrl) {
    openBgSettings(true);
    return;
  }
  if (!state.bg.imageLoaded) loadBgImage(state.bg.imageUrl);
  setBgImageEnabled(!state.bg.imageEnabled);
}

let wheelHandlersInstalled = false;

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
      setCharScale(state.offset.scale + 0.05);
      event.preventDefault();
    }
    if (event.ctrlKey && (event.code === 'Minus' || event.code === 'NumpadSubtract')) {
      setCharScale(state.offset.scale - 0.05);
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
    setOffsetX(state.offset.x + Math.round(event.movementX * scale));
    setOffsetY(state.offset.y + Math.round(event.movementY * scale));
  }, true);

  document.addEventListener('wheel', event => {
    const state = getState();
    updateAppearanceScreenState();
    if (!state.offset.wheelControl || !isInAppearanceScreen()) return;
    if (spaceDown || wheelButtonDown) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    event.preventDefault();

    const oldScale = state.offset.scale;
    const nextScale = Math.max(0.1, Math.min(5, +(oldScale + (event.deltaY > 0 ? -0.05 : 0.05)).toFixed(2)));
    if (nextScale === oldScale) return;
    const cw = canvas.width || 2000;
    const ch = canvas.height || 1000;
    const mouseCanvasX = (event.clientX - rect.left) / rect.width * cw;
    const mouseCanvasY = (event.clientY - rect.top) / rect.height * ch;
    const pivotX = mouseCanvasX - 500;
    const pivotY = mouseCanvasY;
    const ratio = nextScale / oldScale;
    setOffsetX(Math.round(pivotX + (state.offset.x - pivotX) * ratio));
    setOffsetY(Math.round(pivotY + (state.offset.y - pivotY) * ratio));
    setCharScale(nextScale);
  }, {passive: false});
}

export function initializeViewBackground() {
  const state = getState();
  if (state.bg.imageEnabled && state.bg.imageUrl) loadBgImage(state.bg.imageUrl);
  if (state.bg.enabled || state.bg.gridEnabled) saveBgAndRefresh();
}
