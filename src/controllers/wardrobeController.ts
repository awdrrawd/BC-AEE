import {
  DEFAULT_BASE_OPACITY,
  DEFAULT_CARD_OPACITY,
  THEME_PRESETS,
  type UiStyle,
  type UiTheme,
  writeUiTheme,
} from '@/core/theme';
import {reloadWardrobeData} from '@/core/wardrobeStorage';
import {isSlotOccupied, perPage, slotName, swapOutfits} from '@/controllers/outfitsController';
import {bumpWardrobeData, getTargetCharacter, getWardrobeState, setWardrobeState} from '@/core/wardrobeStore';
import type {WardrobeFilter, WardrobeSortMode, WardrobeSourceId} from '@/core/types';
import {clamp} from '@/util/math';
import {dismissPrompt} from '@/core/prompts';
import {closeAllDialogs} from '@/core/dialogs';
import {settings} from '@/core/settings';

export const ZOOM_PCT_MIN = 100;
export const ZOOM_PCT_MAX = 200;
export const ZOOM_PCT_STEP = 10;

export function installWardrobeSettingEffects() {
  const resizesWardrobe = [
    settings.wardrobeExtended,
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
  const {theme} = getWardrobeState();
  // Keep the user's opacity choices when switching presets — they're a separate control.
  if (preset) applyTheme({...theme, preset: preset.id, accent: preset.accent, uiStyle: preset.uiStyle, base: ''});
}

export function setCustomAccent(accent: string) {
  applyTheme({...getWardrobeState().theme, preset: 'custom', accent});
}

export function setUiStyle(uiStyle: UiStyle) {
  applyTheme({...getWardrobeState().theme, uiStyle});
}

export function setCustomBase(base: string) {
  applyTheme({...getWardrobeState().theme, base});
}

export function clearCustomBase() {
  applyTheme({...getWardrobeState().theme, base: ''});
}

export function setBaseOpacity(baseOpacity: number) {
  applyTheme({...getWardrobeState().theme, baseOpacity});
}

export function setCardOpacity(cardOpacity: number) {
  applyTheme({...getWardrobeState().theme, cardOpacity});
}

export function resetOpacity() {
  applyTheme({...getWardrobeState().theme, baseOpacity: DEFAULT_BASE_OPACITY, cardOpacity: DEFAULT_CARD_OPACITY});
}

/** Double-click entry point: select the slot and, if it holds an outfit, open metadata edit mode. */
export function startEditingOutfit(index: number) {
  setWardrobeState({selection: index, name: nameForSlot(index), editing: isSlotOccupied(index)});
}

export function stopEditingOutfit() {
  setWardrobeState({editing: false});
}

function snapshotAppearance(character: Character): string | null {
  try {
    return CharacterAppearanceStringify(character);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to snapshot the entry appearance', error);
    return null;
  }
}

export function resetWardrobeScreen(target: Character) {
  setWardrobeState({
    activeFilter: null,
    sortMode: 'default',
    offset: 0,
    selection: -1,
    name: String(target?.Name || Player?.Name || '').trim(),
    editing: false,
    reorderMode: false,
    reorderFirst: -1,
    zoomPct: 100,
    panX: 0,
    panY: 0,
    target,
    entryAppearance: snapshotAppearance(target),
    triedOn: false,
  });
  closeAllDialogs();
  dismissPrompt();
}

/** Marks that a try-on changed the worn look, so the revert control can appear. */
export function markTriedOn() {
  if (!getWardrobeState().triedOn) setWardrobeState({triedOn: true});
}

/** Restores the character to exactly how it looked when the wardrobe was opened. */
export function revertTryOn() {
  const {entryAppearance, target} = getWardrobeState();
  if (!entryAppearance) return;
  const character = target ?? Player;
  try {
    CharacterAppearanceRestore(character, entryAppearance);
    CharacterRefresh(character, false);
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to revert the try-on', error);
    return;
  }
  setWardrobeState({triedOn: false});
  bumpWardrobeData();
}

export function saveWardrobeCategories(categories: string[]) {
  settings.wardrobeCategories.set(categories);
  const {activeFilter} = getWardrobeState();
  if (activeFilter && activeFilter !== 'favorite' && !categories.includes(activeFilter)) setFilter(null);
}

export function setSearch(search: string) {
  setWardrobeState({search, offset: 0});
}

export function setWardrobeSource(source: WardrobeSourceId) {
  if (source === getWardrobeState().source) return;
  settings.wardrobeSource.set(source);
  setWardrobeState({source, selection: -1, name: targetCharacterName(), editing: false, offset: 0, reorderMode: false, reorderFirst: -1});
  bumpWardrobeData();
}

export function setFilter(activeFilter: WardrobeFilter) {
  setWardrobeState({activeFilter, offset: 0});
}

export function setSortMode(sortMode: WardrobeSortMode) {
  setWardrobeState({sortMode, offset: 0});
}

export function goToPage(page: number, pageCount: number) {
  setWardrobeState({offset: clamp(page, 0, pageCount - 1) * perPage()});
}

/** The dressed character's name, used as the default outfit name for empty/unselected slots. */
export function targetCharacterName(): string {
  const character = getTargetCharacter();
  return String(character?.Name || Player?.Name || '').trim();
}

/** A slot's saved name, falling back to the character's name so empty slots pre-fill sensibly. */
function nameForSlot(index: number): string {
  return slotName(index) || targetCharacterName();
}

export function selectSlot(index: number) {
  setWardrobeState({selection: index, name: nameForSlot(index), editing: false});
}

export function clearSelection() {
  setWardrobeState({selection: -1, name: targetCharacterName(), editing: false});
}

export const DEFAULT_PANEL_LAYOUT = ['list', 'grid', 'manage', 'preview'];

export function resetPanelLayout() {
  settings.wardrobePanelLayout.set([...DEFAULT_PANEL_LAYOUT]);
}

export function swapPanels(a: string, b: string) {
  if (a === b) return;
  const layout = [...settings.wardrobePanelLayout.get()];
  const ia = layout.indexOf(a);
  const ib = layout.indexOf(b);
  if (ia < 0 || ib < 0) return;
  [layout[ia], layout[ib]] = [layout[ib], layout[ia]];
  settings.wardrobePanelLayout.set(layout);
}

export function togglePanel(id: string) {
  if (id === 'grid') return; // the outfit grid is mandatory
  const layout = settings.wardrobePanelLayout.get();
  if (layout.includes(id)) {
    settings.wardrobePanelLayout.set(layout.filter(entry => entry !== id));
    return;
  }
  // Re-insert a hidden panel at its natural position relative to the visible ones.
  const target = DEFAULT_PANEL_LAYOUT.indexOf(id);
  let insertAt = layout.length;
  for (let index = 0; index < layout.length; index++) {
    if (DEFAULT_PANEL_LAYOUT.indexOf(layout[index]) > target) {
      insertAt = index;
      break;
    }
  }
  const next = [...layout];
  next.splice(insertAt, 0, id);
  settings.wardrobePanelLayout.set(next);
}

export function setName(name: string) {
  setWardrobeState({name});
}

export function jumpToSlot(index: number, positionInList: number) {
  setWardrobeState({
    search: '',
    activeFilter: null,
    selection: index,
    name: nameForSlot(index),
    editing: false,
    offset: positionInList >= 0 ? Math.floor(positionInList / perPage()) * perPage() : 0,
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
