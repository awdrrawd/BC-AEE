import bcAeeModSdk from '@/modsdk';
import {getCanvasRect} from '@/core/bc';
import {settings} from '@/core/settings';
import {backupOnlineWardrobe, onlineWardrobeSize, reloadWardrobeData} from '@/core/wardrobeStorage';
import {installWardrobeSettingEffects, resetWardrobeScreen} from '@/controllers/wardrobeController';
import {bumpWardrobeData, DEFAULT_RETURN_SCREEN, getWardrobeState, setWardrobeState} from '@/core/wardrobeStore';

const WARDROBE_SCREEN_MODULE: string = 'Character';
const WARDROBE_SCREEN_NAME: string = 'WardrobePlus';

function resolveTarget(): Character {
  const selection = CharacterAppearanceSelection;
  return typeof selection?.IsPlayer === 'function' ? selection : Player;
}

export function wardrobeLoad() {
  reloadWardrobeData();

  resetWardrobeScreen(resolveTarget());
  setWardrobeState({active: true, canvasRect: getCanvasRect()});
  bumpWardrobeData();
}

export function wardrobeRun() {
  const rect = getCanvasRect();
  const current = getWardrobeState().canvasRect;
  if (!rect) return;
  if (current
    && current.left === rect.left
    && current.top === rect.top
    && current.width === rect.width
    && current.height === rect.height) {
    return;
  }
  setWardrobeState({canvasRect: rect});
}

export function wardrobeExit() {
  const [module, name] = getWardrobeState().returnScreen ?? DEFAULT_RETURN_SCREEN;
  CommonSetScreen(module, name);
}

export function wardrobeUnload() {
  setWardrobeState({active: false});
}

export function enterWardrobeScreen() {
  if (typeof CurrentScreen === 'string' && CurrentScreen !== WARDROBE_SCREEN_NAME) {
    setWardrobeState({returnScreen: [CurrentModule, CurrentScreen]});
  }

  CommonSetScreen(WARDROBE_SCREEN_MODULE, WARDROBE_SCREEN_NAME)
    .catch(error => console.error('🐈‍⬛ [AEE] ❌ Failed to open the wardrobe screen', error));
}

export function registerWardrobeScreen() {
  const globals = window as unknown as Record<string, unknown>;
  globals[`${WARDROBE_SCREEN_NAME}Load`] = wardrobeLoad;
  globals[`${WARDROBE_SCREEN_NAME}Run`] = wardrobeRun;
  globals[`${WARDROBE_SCREEN_NAME}Exit`] = wardrobeExit;
  globals[`${WARDROBE_SCREEN_NAME}Unload`] = wardrobeUnload;
  globals[`${WARDROBE_SCREEN_NAME}Click`] = () => {};
  globals[`${WARDROBE_SCREEN_NAME}Resize`] = () => {};
  globals[`${WARDROBE_SCREEN_NAME}Background`] = 'Private';
}

function isOnWardrobeScreen(): boolean {
  return CurrentScreen === WARDROBE_SCREEN_NAME;
}

export function installWardrobeHooks() {
  installWardrobeSettingEffects();
  registerWardrobeScreen();

  bcAeeModSdk.hookFunction('TextLoad', 1, (args, next) => {
    if (!isOnWardrobeScreen()) return next(args);
    return {loadedPromise: Promise.resolve()} as unknown as TextCache;
  });

  bcAeeModSdk.hookFunction('CharacterCompressWardrobe', 0, (args, next) => {
    const wardrobe = args[0];
    if (!Array.isArray(wardrobe)) return next(args);

    const onlineSize = onlineWardrobeSize();
    const hasLocalTail = wardrobe === Player.Wardrobe || wardrobe.length > onlineSize;
    const onlineWardrobe = hasLocalTail ? wardrobe.slice(0, onlineSize) : wardrobe;
    if (settings.wardrobeCacheOnline.get()) backupOnlineWardrobe(onlineWardrobe);
    return onlineWardrobe === wardrobe ? next(args) : next([onlineWardrobe]);
  });

  window.Liko = window.Liko ?? {};
  window.Liko.Wardrobe = {open: enterWardrobeScreen, exit: wardrobeExit};
}
