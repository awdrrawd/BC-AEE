import bcAeeModSdk from '@/modsdk';
import {runtime} from '@/core/runtime';
import {
  setCharControlVisible,
  startHoverCharHighlight,
  stopHoverCharHighlight,
  syncAfterBcRender
} from '@/controllers/uiController';
import {getState} from '@/core/store';
import {drawAboveGridIfNeeded, removeBgHook} from '@/controllers/backgroundController';
import {
  isAppearanceGroupsPhase,
  markAppearanceRunEnd,
  markAppearanceRunStart,
  observeAppearanceScreenState,
  onAppearanceScreenTransition,
  shouldShowAppearanceViewControl,
  updateAppearanceScreenState,
} from '@/core/appearanceScreenMachine';

export function installAppearanceHooks() {
  onAppearanceScreenTransition(transition => {
    if (shouldShowAppearanceViewControl()) setCharControlVisible(true);
    else setCharControlVisible(false);

    if (transition.leftAppearance) {
      removeBgHook();
      stopHoverCharHighlight();
    }

    if (transition.phaseChanged && transition.current.phase !== 'groups') {
      stopHoverCharHighlight();
    }

    syncAfterBcRender();
  });

  bcAeeModSdk.hookFunction('CharacterAppearanceVisible', 1, (args, next) => {
    if (!getState().hoverHighlightChar) return next(args);
    const character = args[0];
    const groupName = args[2];
    const isAppearanceChar = CharacterAppearanceSelection === character;
    if (isAppearanceChar && runtime.hoverCharGroup && groupName === runtime.hoverCharGroup && runtime.hoverCharHiddenGroup.has(groupName)) return false;
    return next(args);
  });

  bcAeeModSdk.hookFunction('AppearanceRun', 1, (args, next) => {
    updateAppearanceScreenState();
    if (shouldShowAppearanceViewControl()) setCharControlVisible(true);
    syncAfterBcRender();

    handleHoverCharHighlight(isAppearanceGroupsPhase());

    markAppearanceRunStart();
    const result = next(args);
    markAppearanceRunEnd();
    updateAppearanceScreenState();
    drawAboveGridIfNeeded();
    return result;
  });

  bcAeeModSdk.hookFunction('DrawCharacter', 1, (args, next) => {
    if (!runtime.inAppearanceRun) return next(args);
    const state = getState();
    const character = args[0];
    const scale = args[3];
    const isTarget = character && character === CharacterAppearanceSelection;
    if (scale === 4) {
      if (!isTarget) return next(args);
      if (state.hideCloseup) return;
      return next(args);
    }
    if (Math.abs(scale - 1) < 0.1 || Math.abs(scale - 0.95) < 0.05) {
      if (!isTarget) return next(args);
      if (state.hideFullbody) return;
      const previewOffset = runtime.offsetPreview;
      const offsetX = previewOffset?.x ?? state.offset.x;
      const offsetY = previewOffset?.y ?? state.offset.y;
      const hasOffset = offsetX !== 0 || offsetY !== 0 || state.offset.scale !== 1;
      if (hasOffset) {
        const nextArgs: (typeof args) = [...args];
        nextArgs[1] = args[1] + offsetX;
        nextArgs[2] = args[2] + offsetY;
        nextArgs[3] = args[3] * state.offset.scale;
        return next(nextArgs);
      }
      return next(args);
    }
    return next(args);
  });

  bcAeeModSdk.hookFunction('AppearanceLoad', 1, (args, next) => {
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('AppearanceExit', 1, (args, next) => {
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('CharacterAppearanceExit', 1, (args, next) => {
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('CharacterAppearanceReady', 1, (args, next) => {
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('CharacterAppearanceWardrobeLoad', 1, (args, next) => {
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('AppearanceItemColor', 1, (args, next) => {
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('CommonSetScreen', 1, (args, next) => {
    updateAppearanceScreenState();
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('AppearanceClick', 0, (args, next) => {
    if (isEditingBody()) {
      const mode = CharacterAppearanceMode ?? '';
      if (mode === 'Color' || mode === 'Cloth' || mode === 'Permissions') return next(args);
      if (MouseY > 90) return;
    }
    return next(args);
  });

  bcAeeModSdk.hookFunction('CommonClick', 0, (args, next) => {
    if (isEditingBody() && isBodyClick()) return;
    return next(args);
  });

  bcAeeModSdk.hookFunction('DialogClick', 0, (args, next) => {
    if (isEditingBody() && isBodyClick()) return;
    return next(args);
  });

  bcAeeModSdk.hookFunction('AppearancePreviewCleanup', 0, (args, next) => {
    try {
      return next(args);
    } catch {
      AppearancePreviews = [];
      try {
        Character
          .filter(character => character?.CharacterID?.startsWith?.('AppearancePreview-'))
          .forEach(character => {
            try {
              CharacterDelete(character);
            } catch {
              // Continue deleting other preview characters.
            }
          });
      } catch {
        // Ignore preview list cleanup failures.
      }
    }
  });
}

function handleHoverCharHighlight(isAppearance: boolean) {
  const state = getState();
  if (state.hoverHighlightChar && isAppearance
    && CharacterAppearanceMode === ''
    && typeof CharacterAppearanceGroups !== 'undefined'
    && typeof CharacterAppearanceOffset !== 'undefined'
    && typeof CharacterAppearanceNumGroupPerPage !== 'undefined') {
    let hoveredGroup: AssetGroupName | null = null;
    const mouseX = MouseX;
    const mouseY = MouseY;
    if (mouseX >= 1120 && mouseX < 1975 && mouseY >= 145 && mouseY < 980) {
      const offset = CharacterAppearanceOffset;
      const groups = CharacterAppearanceGroups;
      const numPerPage = CharacterAppearanceNumGroupPerPage;
      for (let index = offset; index < groups.length && index < offset + numPerPage; index++) {
        const itemY = 145 + (index - offset) * 95;
        if (mouseY >= itemY && mouseY < itemY + 65) {
          hoveredGroup = groups[index].Name;
          break;
        }
      }
    }
    if (hoveredGroup !== runtime.hoverCharGroup) {
      stopHoverCharHighlight();
      runtime.hoverCharGroup = hoveredGroup;
      if (hoveredGroup) startHoverCharHighlight(hoveredGroup);
    }
  } else if (runtime.hoverCharGroup !== null) {
    stopHoverCharHighlight();
  }
}

function isEditingBody() {
  const state = getState();
  return !!(state.visible && state.activeDrag);
}

function isBodyClick() {
  const mouseX = typeof MouseX !== 'undefined' ? MouseX : 9999;
  const mouseY = typeof MouseY !== 'undefined' ? MouseY : 9999;
  if (mouseY < 90) return false;
  const mode = CharacterAppearanceMode ?? '';
  if (mode === 'Color') return false;
  const screen = CurrentScreen ?? '';
  if (screen === 'ChatRoom' || screen === 'ChatSearch' || screen === 'Appearance') return mouseX < 1000;
  return false;
}
