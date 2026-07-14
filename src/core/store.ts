import {settings} from '@/core/settings';
import type {AeeState} from '@/core/types';
import {MOD_VERSION} from '@/core/version';
import {createExternalStore} from '@/core/externalStore';

const savedCtrlPos = settings.charCtrlPos.get();

const initialState: AeeState = {
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
  partsFilterMode: 'all',
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
    eyedropperActive: false,
  },
  opacityOverlay: {
    open: false,
  },
  transformOverlay: {
    mode: null,
  },
  rotationOverlayOpen: false,
  bg: {
    imageLoaded: false,
    settingsOpen: false,
  },
  offset: {
    open: false,
    collapsed: false,
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
    bgSubOpen: false,
    hideSubOpen: false,
  },
  importDialog: null,
};

const store = createExternalStore(initialState);

export function emitAeeStoreChange() {
  store.setState(current => ({...current}));
}

export function getState() {
  return store.getState();
}

export function setState(patch: Partial<AeeState>) {
  store.patchState(patch);
}

export function mutateState(mutator: (draft: AeeState) => void) {
  const draft = structuredCloneShallow(store.getState());
  mutator(draft);
  store.setState(draft);
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
    importDialog: value.importDialog,
  };
}

export const subscribe = store.subscribe;

export function useAeeStore() {
  return store.useStore();
}
