import {getState, mutateState} from '@/core/store';
import type {PartsFilterMode} from '@/core/types';
import {isAppearanceOverlayActive} from '@/controllers/copyPasteController';
import {t} from '@/i18n/i18n';

// Native BC icon used for the top-bar button. If the game doesn't ship this
// icon under this name, BC's own image-not-found fallback handles it - same
// as any other icon path handed to DrawButton.
const PARTS_FILTER_ICON = 'Icons/Dress.png';

const MODE_ORDER: PartsFilterMode[] = ['all', 'has', 'empty'];

// Literal on-button labels (not translated - they're short state badges, not
// sentences, and are meant to read the same regardless of UI language).
const MODE_LABEL: Record<PartsFilterMode, string> = {
  all: 'ALL',
  has: 'Enable',
  empty: 'Disable',
};

const MODE_COLOR: Record<PartsFilterMode, string> = {
  all: '#000000',
  has: '#3ECF5D',
  empty: '#FF5C5C',
};

// Always resets to 'all' when (re)entering the appearance screen - the
// filter is a per-session convenience, not a saved preference.
export function resetPartsFilterMode() {
  if (getState().partsFilterMode === 'all') return;
  mutateState(draft => {
    draft.partsFilterMode = 'all';
  });
}

export function cyclePartsFilterMode() {
  const current = getState().partsFilterMode;
  const next = MODE_ORDER[(MODE_ORDER.indexOf(current) + 1) % MODE_ORDER.length];
  mutateState(draft => {
    draft.partsFilterMode = next;
  });
  // Pagination offset is an index into whatever list is currently shown; a
  // mode switch can shrink that list out from under the page the user was
  // on, so snap back to the top rather than risk landing on a blank page.
  if (typeof CharacterAppearanceOffset !== 'undefined') CharacterAppearanceOffset = 0;
}

function isGroupsScreen(): boolean {
  return typeof CharacterAppearanceMode !== 'undefined'
    && CharacterAppearanceMode === ''
    && typeof CharacterAppearanceGroups !== 'undefined'
    && !isAppearanceOverlayActive();
}

// Whether the top-bar button should exist at all right now (setting on,
// and we're looking at the groups list rather than Wardrobe/Cloth/Color/etc).
export function isPartsFilterAvailable(): boolean {
  return getState().enablePartsFilter && isGroupsScreen();
}

function groupHasItem(character: Character, group: AssetGroup): boolean {
  return !!InventoryGet(character, group.Name);
}

function filterGroups(character: Character, groups: readonly AssetGroup[], mode: PartsFilterMode): AssetGroup[] {
  if (mode === 'all') return groups as AssetGroup[];
  const wantWorn = mode === 'has';
  return groups.filter(group => groupHasItem(character, group) === wantWorn);
}

// Temporarily swaps the native CharacterAppearanceGroups list for a filtered
// one for the duration of `fn`, so BC's own row layout/pagination/click math
// - and our other row overlays, which read the same global directly - all
// agree on which rows exist without us having to reimplement any of it.
export function withFilteredGroups<T>(fn: () => T): T {
  const character = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
  const state = getState();
  if (!character || state.partsFilterMode === 'all' || !isPartsFilterAvailable() || typeof CharacterAppearanceGroups === 'undefined') {
    return fn();
  }
  const original = CharacterAppearanceGroups;
  const filtered = filterGroups(character, original, state.partsFilterMode);
  if (typeof CharacterAppearanceOffset !== 'undefined' && CharacterAppearanceOffset >= filtered.length) {
    CharacterAppearanceOffset = 0;
  }
  CharacterAppearanceGroups = filtered;
  try {
    return fn();
  } finally {
    CharacterAppearanceGroups = original;
  }
}

// Draws the icon + state badge for the top-bar button. The button chrome
// itself (border/hover/tooltip) is drawn by the caller via DrawButton with
// this icon; this only adds the small colored ALL/Enable/Disable label,
// since DrawButton's own Label text can't be recolored per state.
//
// The button chrome is a fixed 90x90 box; used here just to detect hover so
// the 'all' label can invert to stay readable if BC darkens the background
// on hover.
const PARTS_FILTER_BUTTON_SIZE = 90;

export function drawPartsFilterBadge(x: number, y: number) {
  const mode = getState().partsFilterMode;
  const color = mode === 'all'
    ? (MouseIn(x, y, PARTS_FILTER_BUTTON_SIZE, PARTS_FILTER_BUTTON_SIZE) ? '#FFFFFF' : '#000000')
    : MODE_COLOR[mode];
  DrawTextFit(MODE_LABEL[mode], x + 45, y + 78, 80, color);
}

export function partsFilterIcon(): string {
  return PARTS_FILTER_ICON;
}

export function partsFilterTooltip(): string {
  return t(`parts-filter-tooltip-${getState().partsFilterMode}`);
}
