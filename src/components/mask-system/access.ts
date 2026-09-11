import bcAeeModSdk from '@/modsdk';
import {getAeeStatus} from '@/core/aeePresence';
import {DRAW_GROUPS, SG_MASK_GROUP, drawMaskGroupName, drawVisibleGroupName} from './constants';

const drawingGroups = new Set<string>([
  ...DRAW_GROUPS, ...DRAW_GROUPS.map(drawMaskGroupName), ...DRAW_GROUPS.map(drawVisibleGroupName),
]);

/** Ordinary BC groups keep BC permissions; custom groups require a live capable wearer. */
export function getAeeGroupBlockReason(character: Character | number, group: string): string | null {
  if (group !== SG_MASK_GROUP && !drawingGroups.has(group)) return null;
  const status = getAeeStatus(character);
  if (!status.enabled) return 'aee-access-unavailable';
  if (group === SG_MASK_GROUP || status.freeDraw === true) return null;
  return status.freeDraw === false ? 'aee-access-drawing-disabled' : 'aee-access-settings-pending';
}

export function canUseAeeGroup(character: Character | number, group: string): boolean {
  return getAeeGroupBlockReason(character, group) === null;
}

export function installAeeGroupAccess(): void {
  Object.assign(window.Liko.AEE, {canUseGroup: canUseAeeGroup, getGroupBlockReason: getAeeGroupBlockReason});
  bcAeeModSdk.hookFunction('AppearanceGroupAllowed', 1, (args, next) =>
    canUseAeeGroup(args[0], args[1]) && next(args));
  bcAeeModSdk.hookFunction('InventoryAllow', 1, (args, next) =>
    canUseAeeGroup(args[0], args[1].Group.Name) && next(args));
  // Use the same capability rule for visibility, wearing and removal.
  bcAeeModSdk.hookFunction('InventoryWear', 1, (args, next) =>
    canUseAeeGroup(args[0], args[2]) ? next(args) : null);
  bcAeeModSdk.hookFunction('CharacterAppearanceSetItem', 1, (args, next) =>
    canUseAeeGroup(args[0], args[1]) ? next(args) : null);
  bcAeeModSdk.hookFunction('InventoryRemove', 1, (args, next) => {
    if (canUseAeeGroup(args[0], args[1])) return next(args);
  });
}
