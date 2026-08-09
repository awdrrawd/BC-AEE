import {runtime} from '@/core/runtime';
import {t} from '@/i18n/i18n';
import {isAppearanceOverlayActive} from '@/controllers/copyPasteController';
import {isInAppearanceScreen} from '@/core/appearanceScreenMachine';
import {settings} from '@/core/settings';

const HIDE_RESTRAINTS_ICON = 'Icons/Kidnap.png';

function isGroupsScreen(): boolean {
  return CharacterAppearanceMode === '' && !isAppearanceOverlayActive();
}

export function isHideRestraintsAvailable(): boolean {
  return settings.enableHideRestraints.get() && isGroupsScreen();
}

export function isHideRestraintsActive(): boolean {
  return runtime.hideRestraints;
}

export function hideRestraintsIcon(): string {
  return HIDE_RESTRAINTS_ICON;
}

export function hideRestraintsTooltip(): string {
  return t(runtime.hideRestraints ? 'hide-restraints-tooltip-on' : 'hide-restraints-tooltip-off');
}

// "Restraints" = anything worn in an Item-category group (ItemArms, ItemVulva,
// ItemDevices, …). Asset.IsRestraint alone misses toys/plugs that sit in those
// groups without a restraining flag — matching how SCA-temp scopes it.
function isRestraintItem(item: Item | null | undefined): boolean {
  return item?.Asset?.Group?.Category === 'Item';
}

// Re-applied on every canvas build while active: build the appearance preview
// from a copy of the appearance without the Item-group items. C.Appearance is
// swapped only for the duration of the build and restored immediately, so the
// worn restraints are NEVER removed — the toggle survives clothing changes and
// Accept always commits the real, restraint-bearing appearance.
export function withRestraintsHidden(C: Character, build: () => void): void {
  if (!runtime.hideRestraints
    || C !== CharacterAppearanceSelection
    || !isInAppearanceScreen()
    || !Array.isArray(C.Appearance)) {
    build();
    return;
  }
  const original = C.Appearance;
  const filtered = original.filter(item => !isRestraintItem(item));
  if (filtered.length === original.length) {
    build();
    return;
  }
  C.Appearance = filtered;
  try {
    build();
  } finally {
    C.Appearance = original;
  }
}

// Turn hiding off (leaving the screen, or the flag needs a hard reset). Refresh
// the given character so the now-unfiltered restraints redraw.
export function clearHideRestraints(character?: Character | null): void {
  if (!runtime.hideRestraints) return;
  runtime.hideRestraints = false;
  if (character) CharacterRefresh(character, false, false);
}

export function toggleHideRestraints(): void {
  const C = CharacterAppearanceSelection;
  if (!C) return;
  runtime.hideRestraints = !runtime.hideRestraints;
  // CharacterRefresh (not CharacterLoadCanvas) forces the WebGL preview to
  // rebuild; the CharacterLoadCanvas hook then applies or drops the filter.
  // Push=false keeps this preview-only change off the server.
  CharacterRefresh(C, false, false);
}
