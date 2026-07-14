import {THEME_PRESETS, type UiStyle, type UiTheme, writeUiTheme} from '@/core/theme';
import {reloadWardrobeData} from '@/core/wardrobeStorage';
import {PER_PAGE, slotName, swapOutfits} from '@/controllers/outfitsController';
import {bumpWardrobeData, getWardrobeState, setWardrobeState} from '@/core/wardrobeStore';
import type {
  WardrobeFilter,
  WardrobeMode,
  WardrobeSettingsTab,
  WardrobeSortMode,
} from '@/core/types';
import {clamp} from '@/util/math';
import {dismissPrompt} from '@/core/prompts';
import {settings} from '@/core/settings';

export const ZOOM_PCT_MIN = 100;
export const ZOOM_PCT_MAX = 200;
export const ZOOM_PCT_STEP = 10;

export function installWardrobeSettingEffects() {
  const resizesWardrobe = [
    settings.wardrobeExtended,
    settings.wardrobeLocal,
    settings.wardrobeShared,
  ];
  resizesWardrobe.forEach(setting => setting.onChange(() => reloadWardrobeData()));
  resizesWardrobe.forEach(setting => setting.onChange(() => bumpWardrobeData()));
}

function applyTheme(theme: UiTheme) {
  writeUiTheme(theme);
  setWardrobeState({theme});
}

export function selectThemePreset(presetId: string) {
  const preset = THEME_PRESETS.find(candidate => candidate.id === presetId);
  if (preset) applyTheme({preset: preset.id, accent: preset.accent, uiStyle: preset.uiStyle});
}

export function setCustomAccent(accent: string) {
  applyTheme({...getWardrobeState().theme, preset: 'custom', accent});
}

export function setUiStyle(uiStyle: UiStyle) {
  applyTheme({...getWardrobeState().theme, uiStyle});
}

export function resetWardrobeScreen(target: Character) {
  setWardrobeState({
    mode: 'grid',
    settingsTab: 'general',
    activeFilter: null,
    sortMode: 'default',
    offset: 0,
    selection: -1,
    name: '',
    reorderMode: false,
    reorderFirst: -1,
    zoomPct: 100,
    panX: 0,
    panY: 0,
    target,
    importBuffer: [],
    importSelected: new Set<number>(),
    importTargets: new Map<number, number>(),
  });
  dismissPrompt();
}

export function openDialog(mode: WardrobeMode) {
  setWardrobeState({mode});
}

export function closeDialog() {
  setWardrobeState({mode: 'grid'});
}

export function setSettingsTab(settingsTab: WardrobeSettingsTab) {
  setWardrobeState({settingsTab});
}

export function setSearch(search: string) {
  setWardrobeState({search, offset: 0});
}

export function setFilter(activeFilter: WardrobeFilter) {
  setWardrobeState({activeFilter, offset: 0});
}

export function setSortMode(sortMode: WardrobeSortMode) {
  setWardrobeState({sortMode, offset: 0});
}

export function goToPage(page: number, pageCount: number) {
  setWardrobeState({offset: clamp(page, 0, pageCount - 1) * PER_PAGE});
}

export function selectSlot(index: number) {
  setWardrobeState({selection: index, name: slotName(index)});
}

export function setName(name: string) {
  setWardrobeState({name});
}

export function jumpToSlot(index: number, positionInList: number) {
  setWardrobeState({
    search: '',
    activeFilter: null,
    selection: index,
    name: slotName(index),
    offset: positionInList >= 0 ? Math.floor(positionInList / PER_PAGE) * PER_PAGE : 0,
  });
}

export function toggleReorderMode() {
  setWardrobeState({reorderMode: !getWardrobeState().reorderMode, reorderFirst: -1});
}

export function markOrSwap(index: number) {
  const {reorderFirst} = getWardrobeState();
  if (reorderFirst === -1) {
    setWardrobeState({reorderFirst: index});
    return;
  }
  if (reorderFirst === index) return;
  swapOutfits(reorderFirst, index);
  setWardrobeState({reorderMode: false, reorderFirst: -1});
}

export function setZoom(zoomPct: number) {
  const next = clamp(zoomPct, ZOOM_PCT_MIN, ZOOM_PCT_MAX);
  setWardrobeState(next <= ZOOM_PCT_MIN ? {zoomPct: next, panX: 0, panY: 0} : {zoomPct: next});
}

export function setPan(panX: number, panY: number) {
  setWardrobeState({panX, panY});
}

export function resetZoom() {
  setWardrobeState({zoomPct: ZOOM_PCT_MIN, panX: 0, panY: 0});
}

export function toggleAllImportSelection() {
  const {importBuffer, importTargets, importSelected} = getWardrobeState();
  const selectable = importBuffer
    .map((_, index) => index)
    .filter(index => (importTargets.get(index) ?? -1) >= 0);

  const allSelected = selectable.length > 0 && selectable.every(index => importSelected.has(index));
  setWardrobeState({importSelected: new Set(allSelected ? [] : selectable)});
}

export function toggleImportSelection(index: number) {
  if ((getWardrobeState().importTargets.get(index) ?? -1) < 0) return;
  const selected = new Set(getWardrobeState().importSelected);
  if (selected.has(index)) selected.delete(index);
  else selected.add(index);
  setWardrobeState({importSelected: selected});
}
