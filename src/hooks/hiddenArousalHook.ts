import bcAeeModSdk from '@/modsdk';
import {settings} from '@/core/settings';

const REGISTRY_KEY = '__hotfix_HiddenArousal';

interface HiddenArousalRegistry {
  version: 1;
  installed: boolean;
  providers: Record<string, () => boolean>;
}

type LikoWithHiddenArousal = Record<string, unknown> & {
  [REGISTRY_KEY]?: HiddenArousalRegistry;
};

function shouldHideArousalUi(): boolean {
  if (!settings.hideArousalUi.get()) return false;
  if (CurrentScreen === 'Appearance' || CurrentScreen === 'InformationSheet') return true;
  if (CurrentScreen !== 'ChatRoom') return false;

  try {
    return typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null;
  } catch {
    return false;
  }
}

function getRegistry(): HiddenArousalRegistry {
  const liko = window.Liko as LikoWithHiddenArousal;
  const current = liko[REGISTRY_KEY];
  if (current?.version === 1 && current.providers) return current;

  return liko[REGISTRY_KEY] = {version: 1, installed: false, providers: {}};
}

/** Registers AEE with the shared HHA/LCE coordinator and installs its single hook if needed. */
export function installHiddenArousalHook() {
  const registry = getRegistry();
  registry.providers.AEE = shouldHideArousalUi;
  if (registry.installed) return;

  try {
    bcAeeModSdk.hookFunction('DrawArousalMeter', 10, (args, next) => {
      for (const provider of Object.values(registry.providers)) {
        try {
          if (provider()) return;
        } catch {
          // A broken or unloading provider must not prevent the remaining HUD from rendering.
        }
      }
      return next(args);
    });
    registry.installed = true;
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] DrawArousalMeter hook unavailable:', error);
  }
}
