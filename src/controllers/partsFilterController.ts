import {getState, mutateState} from '@/core/store';
import type {PartsFilterMode} from '@/core/types';
import {isAppearanceOverlayActive} from '@/controllers/copyPasteController';
import {t} from '@/i18n/i18n';
import {settings} from '@/core/settings';

const PARTS_FILTER_ICON = 'Icons/Dress.png';

const MODE_ORDER: PartsFilterMode[] = ['all', 'has', 'empty'];

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
  CharacterAppearanceOffset = 0;
}

function isGroupsScreen(): boolean {
  return CharacterAppearanceMode === '' && !isAppearanceOverlayActive();
}

export function isPartsFilterAvailable(): boolean {
  return settings.enablePartsFilter.get() && isGroupsScreen();
}

function groupHasItem(character: Character, group: AssetGroup): boolean {
  return !!InventoryGet(character, group.Name);
}

function filterGroups(character: Character, groups: readonly AssetGroup[], mode: PartsFilterMode): AssetGroup[] {
  if (mode === 'all') return groups as AssetGroup[];
  const wantWorn = mode === 'has';
  return groups.filter(group => groupHasItem(character, group) === wantWorn);
}

export function withFilteredGroups<T>(fn: () => T): T {
  const character = CharacterAppearanceSelection;
  const state = getState();
  if (!character || state.partsFilterMode === 'all' || !isPartsFilterAvailable()) return fn();
  const original = CharacterAppearanceGroups;
  const filtered = filterGroups(character, original, state.partsFilterMode);
  if (CharacterAppearanceOffset >= filtered.length) CharacterAppearanceOffset = 0;
  CharacterAppearanceGroups = filtered;
  try {
    return fn();
  } finally {
    CharacterAppearanceGroups = original;
  }
}

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
