import {getCanvasRect, getCurrentGroup, getCurrentItem, getAppearanceMode, isEditableAppearanceContext} from './bc';
import {getState, mutateState, setState} from './store';
import {runtime} from './runtime';

let lastGroup: string | null = null;
let lastAsset: string | null = null;
let lastMode: string | null = null;

export function syncCanvasRect() {
  const rect = getCanvasRect();
  setState({canvasRect: rect});
  return rect;
}

export function syncCurrentContext() {
  const item = getCurrentItem();
  const group = getCurrentGroup();
  const mode = getAppearanceMode();
  const visible = isEditableAppearanceContext();
  const assetName = item?.Asset?.Name ?? null;
  const groupName = item?.Asset?.Group?.Name ?? group ?? null;
  const itemChanged = group !== lastGroup || assetName !== lastAsset || mode !== lastMode;

  mutateState(draft => {
    draft.visible = visible;
    draft.canvasRect = getCanvasRect();
    draft.item = visible ? item : null;
    draft.group = visible ? group : null;
    draft.mode = mode;
    draft.layers = visible ? (item?.Asset?.Layer || []) : [];
    draft.itemAssetName = visible ? assetName : null;
    draft.itemGroupName = visible ? groupName : null;
    if (!visible) {
      draft.activeDrag = null;
      draft.rotationOverlayOpen = false;
      draft.opacityOverlay.open = false;
    } else if (itemChanged) {
      draft.selectedLayer = null;
      draft.activeDrag = null;
      draft.partsOpen = false;
      draft.rotationOverlayOpen = false;
      draft.opacityOverlay.open = false;
    }
  });

  if (itemChanged) {
    runtime.hoverLayerIdx = null;
    runtime.hoverCooldownUntil = Date.now() + 300;
    lastGroup = group;
    lastAsset = assetName;
    lastMode = mode;
  }

  return getState();
}

export function forceUiUpdate() {
  mutateState(() => {});
}
