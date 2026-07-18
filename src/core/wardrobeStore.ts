import type {CanvasRect} from '@/core/types';
import type {UiTheme} from '@/core/theme';
import {readUiTheme} from '@/core/theme';
import {createExternalStore} from '@/core/externalStore';
import {settings} from '@/core/settings';
import type {WardrobeFilter, WardrobeSortMode, WardrobeSourceId} from '@/core/types';

export const DEFAULT_RETURN_SCREEN: [string, string] = ['Character', 'Appearance'];

export interface WardrobeState {
  active: boolean;
  canvasRect: CanvasRect | null;
  theme: UiTheme;
  search: string;
  activeFilter: WardrobeFilter;
  sortMode: WardrobeSortMode;
  offset: number;
  selection: number;
  name: string;
  /** The manage panel is in metadata-edit mode (rename + retag the selected outfit). */
  editing: boolean;
  reorderMode: boolean;
  reorderFirst: number;
  zoomPct: number;
  panX: number;
  panY: number;
  target: Character | null;
  returnScreen: [string, string];
  dataVersion: number;
  source: WardrobeSourceId;
  /** Serialized appearance captured on entry, so try-ons can be reverted. */
  entryAppearance: string | null;
  /** A try-on has changed the worn appearance since entry. */
  triedOn: boolean;
}

const initialState: WardrobeState = {
  active: false,
  canvasRect: null,
  theme: readUiTheme(),
  search: '',
  activeFilter: null,
  sortMode: 'default',
  offset: 0,
  selection: -1,
  name: '',
  editing: false,
  reorderMode: false,
  reorderFirst: -1,
  zoomPct: 100,
  panX: 0,
  panY: 0,
  target: null,
  returnScreen: DEFAULT_RETURN_SCREEN,
  dataVersion: 0,
  source: settings.wardrobeSource.get(),
  entryAppearance: null,
  triedOn: false,
};

const store = createExternalStore(initialState);

export function getWardrobeState(): WardrobeState {
  return store.getState();
}

export function setWardrobeState(patch: Partial<WardrobeState>) {
  store.patchState(patch);
}

export function bumpWardrobeData() {
  setWardrobeState({dataVersion: store.getState().dataVersion + 1});
}

export function useWardrobeStore(): WardrobeState {
  return store.useStore();
}

export function getTargetCharacter(): Character {
  return store.getState().target ?? Player;
}
