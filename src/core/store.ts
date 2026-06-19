import {useSyncExternalStore} from 'react';
import {getAeeSetting} from '@/core/settings';
import type {AeeState} from '@/core/types';
import {MOD_VERSION} from '@/core/version';

const savedCtrlPos = getAeeSetting<{ left: number; top: number } | null>('charCtrlPos', null);

let state: AeeState = {
  version: MOD_VERSION,
  visible: false,
  canvasRect: null,
  tab: 'edit',
  selectedLayer: null,
  collapsed: false,
  activeDrag: null,
  scaleLock: true,
  partsOpen: false,
  partsLeft: 10,
  partsTop: 60,
  hoverHighlight: getAeeSetting('hoverHighlight', false),
  hoverHighlightChar: getAeeSetting('hoverHighlightChar', false),
  hideLscgLayers: getAeeSetting('hideLscgLayers', false),
  showCharCtrl: getAeeSetting('showCharCtrl', false),
  hideCloseup: getAeeSetting('hideCloseup', false),
  hideFullbody: getAeeSetting('hideFullbody', false),
  fullbodyOffsetX: getAeeSetting('fullbodyOffsetX', 0),
  enableAeeMenu: getAeeSetting('enableAeeMenu', false),
  useAeeColorPicker: getAeeSetting('useAeeColorPicker', false),
  pasteImport: getAeeSetting('pasteImport', true),
  bcWheelScroll: getAeeSetting('bcWheelScroll', false),
  item: null,
  group: null,
  mode: null,
  layers: [],
  itemAssetName: null,
  itemGroupName: null,
  colorPicker: {
    sessionId: 0,
    open: false,
    bcMode: false,
    collapsed: false,
    hex: '#FFFFFF',
    initialHex: '#FFFFFF',
    opacityPct: 100,
    isDefault: false,
  },
  opacityOverlay: {
    open: false,
  },
  transformOverlay: {
    mode: null,
  },
  rotationOverlayOpen: false,
  bg: {
    enabled: getAeeSetting('bgEnabled', false),
    color: getAeeSetting('bgColor', '#87CEEB'),
    gridEnabled: getAeeSetting('bgGridEnabled', false),
    gridMode: getAeeSetting('bgGridMode', 'line'),
    gridPx: getAeeSetting('bgGridPx', 25),
    gridColor: getAeeSetting('bgGridColor', '#ffffff'),
    gridOpacity: getAeeSetting('bgGridOpacity', 0.25),
    gridLayer: getAeeSetting('bgGridLayer', 'below'),
    imageEnabled: getAeeSetting('bgImgEnabled', false),
    imageUrl: getAeeSetting('bgImgUrl', ''),
    imageLoaded: false,
    settingsOpen: false,
  },
  offset: {
    open: false,
    collapsed: false,
    x: getAeeSetting('charOffsetX', 0),
    y: getAeeSetting('charOffsetY', 0),
    scale: getAeeSetting('charScale', 1),
    wheelControl: false,
  },
  pose: {
    open: false,
    activeIndex: null,
  },
  charControl: {
    open: false,
    visible: false,
    left: savedCtrlPos?.left,
    top: savedCtrlPos?.top,
    expandUp: getAeeSetting('ctrlExpandUp', true),
    subLeft: getAeeSetting('ctrlSubLeft', true),
    bgSubOpen: false,
    hideSubOpen: false,
  },
  importDialog: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function emitAeeStoreChange() {
  emit();
}

export function getState() {
  return state;
}

export function setState(patch: Partial<AeeState>) {
  state = {...state, ...patch};
  emit();
}

export function mutateState(mutator: (draft: AeeState) => void) {
  const draft = structuredCloneShallow(state);
  mutator(draft);
  state = draft;
  emit();
}

function structuredCloneShallow(value: AeeState): AeeState {
  return {
    ...value,
    layers: value.layers,
    colorPicker: {...value.colorPicker},
    opacityOverlay: {...value.opacityOverlay},
    transformOverlay: {...value.transformOverlay},
    bg: {...value.bg},
    offset: {...value.offset},
    pose: {...value.pose},
    charControl: {...value.charControl},
    // Keep the same reference across frames: the dialog is replaced wholesale
    // (open/close), never mutated in place. Cloning it on every render frame
    // would make the picker's identity-based effect re-fire and reset itself.
    importDialog: value.importDialog,
  };
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAeeStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}
