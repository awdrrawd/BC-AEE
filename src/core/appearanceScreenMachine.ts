import {getState} from '@/core/store';
import {runtime} from '@/core/runtime';

export type AppearanceScreenMode = '' | 'Wardrobe' | 'Cloth' | 'Color' | 'Permissions';
export type ItemColorSubMode = ItemColorMode | null;
export type AppearanceScreenPhase =
  'outside'
  | 'groups'
  | 'wardrobe'
  | 'cloth'
  | 'permissions'
  | 'color'
  | 'color-picker'
  | 'extended-item'
  | 'layering';

export interface AppearanceScreenSnapshot {
  module: string;
  screen: string;
  inAppearance: boolean;
  mode: AppearanceScreenMode | null;
  phase: AppearanceScreenPhase;
  itemColorMode: ItemColorSubMode;
  hasDialogFocusItem: boolean;
  layeringActive: boolean;
  selection: Character | null;
}

export interface AppearanceScreenTransition {
  previous: AppearanceScreenSnapshot;
  current: AppearanceScreenSnapshot;
  enteredAppearance: boolean;
  leftAppearance: boolean;
  phaseChanged: boolean;
  modeChanged: boolean;
  selectionChanged: boolean;
}

type TransitionListener = (transition: AppearanceScreenTransition) => void;

let snapshot: AppearanceScreenSnapshot = readAppearanceScreenSnapshot();
const listeners = new Set<TransitionListener>();

export function readAppearanceScreenSnapshot(): AppearanceScreenSnapshot {
  const module = typeof CurrentModule !== 'undefined' ? CurrentModule : '';
  const screen = typeof CurrentScreen !== 'undefined' ? CurrentScreen : '';
  const inAppearance = screen === 'Appearance';
  const mode = readAppearanceMode(inAppearance);
  const itemColorMode = readItemColorMode(inAppearance, mode);
  const hasDialogFocusItem = inAppearance && typeof DialogFocusItem !== 'undefined' && !!DialogFocusItem;
  const layeringActive = inAppearance && typeof Layering !== 'undefined' && !!Layering?.IsActive?.();

  return {
    module,
    screen,
    inAppearance,
    mode,
    phase: resolveAppearancePhase(inAppearance, mode, itemColorMode, hasDialogFocusItem, layeringActive),
    itemColorMode,
    hasDialogFocusItem,
    layeringActive,
    selection: inAppearance && typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection ?? null : null,
  };
}

export function getAppearanceScreenSnapshot() {
  return snapshot;
}

export function updateAppearanceScreenState(): AppearanceScreenTransition | null {
  const previous = snapshot;
  const current = readAppearanceScreenSnapshot();
  if (sameSnapshot(previous, current)) return null;

  snapshot = current;
  const transition: AppearanceScreenTransition = {
    previous,
    current,
    enteredAppearance: !previous.inAppearance && current.inAppearance,
    leftAppearance: previous.inAppearance && !current.inAppearance,
    phaseChanged: previous.phase !== current.phase,
    modeChanged: previous.mode !== current.mode || previous.itemColorMode !== current.itemColorMode,
    selectionChanged: previous.selection !== current.selection,
  };
  listeners.forEach(listener => listener(transition));
  return transition;
}

export function onAppearanceScreenTransition(listener: TransitionListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function observeAppearanceScreenState<T>(value: T): T {
  updateAppearanceScreenState();
  if (isPromiseLike(value)) value.then(updateAppearanceScreenState, updateAppearanceScreenState);
  return value;
}

export function isAppearanceGroupsPhase() {
  return snapshot.phase === 'groups';
}

export function isInAppearanceScreen() {
  return snapshot.inAppearance;
}

export function shouldShowAppearanceViewControl() {
  return snapshot.inAppearance && getState().showCharCtrl;
}

export function markAppearanceRunStart() {
  runtime.inAppearanceRun = true;
}

export function markAppearanceRunEnd() {
  runtime.inAppearanceRun = false;
}

function readAppearanceMode(inAppearance: boolean): AppearanceScreenMode | null {
  if (!inAppearance || typeof CharacterAppearanceMode === 'undefined') return null;
  return CharacterAppearanceMode ?? '';
}

function readItemColorMode(inAppearance: boolean, mode: AppearanceScreenMode | null): ItemColorSubMode {
  if (!inAppearance || mode !== 'Color' || typeof ItemColorCurrentMode === 'undefined') return null;
  return ItemColorCurrentMode ?? null;
}

function resolveAppearancePhase(
  inAppearance: boolean,
  mode: AppearanceScreenMode | null,
  itemColorMode: ItemColorSubMode,
  hasDialogFocusItem: boolean,
  layeringActive: boolean,
): AppearanceScreenPhase {
  if (!inAppearance) return 'outside';
  if (hasDialogFocusItem) return 'extended-item';
  if (layeringActive) return 'layering';
  if (mode === 'Wardrobe') return 'wardrobe';
  if (mode === 'Cloth') return 'cloth';
  if (mode === 'Permissions') return 'permissions';
  if (mode === 'Color') return itemColorMode === 'ColorPicker' ? 'color-picker' : 'color';
  return 'groups';
}

function sameSnapshot(a: AppearanceScreenSnapshot, b: AppearanceScreenSnapshot) {
  return a.module === b.module
    && a.screen === b.screen
    && a.inAppearance === b.inAppearance
    && a.mode === b.mode
    && a.phase === b.phase
    && a.itemColorMode === b.itemColorMode
    && a.hasDialogFocusItem === b.hasDialogFocusItem
    && a.layeringActive === b.layeringActive
    && a.selection === b.selection;
}

function isPromiseLike<T>(value: T): value is T & PromiseLike<unknown> {
  const maybePromise = value as { then?: unknown } | null;
  return !!maybePromise
    && typeof maybePromise === 'object'
    && typeof maybePromise.then === 'function';
}
