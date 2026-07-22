import bcAeeModSdk from '@/modsdk';
import {getCanvasRect} from '@/core/bc';
import {reloadWardrobeData} from '@/core/wardrobeStorage';
import {installWardrobeSettingEffects, resetWardrobeScreen} from '@/controllers/wardrobeController';
import {bumpWardrobeData, DEFAULT_RETURN_SCREEN, getWardrobeState, setWardrobeState} from '@/core/wardrobeStore';

const WARDROBE_SCREEN_MODULE: string = 'Character';
const WARDROBE_SCREEN_NAME: string = 'WardrobePlus';

interface WardrobeBundleExtras {
  AEE: 1;
  D?: number;
  C?: CraftingItem;
}

function isWardrobeBundleExtras(value: unknown): value is WardrobeBundleExtras {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && (value as Partial<WardrobeBundleExtras>).AEE === 1;
}

function parseCompressedWardrobe(value: string): unknown[][] | null {
  try {
    const json = LZString.decompressFromUTF16(value);
    if (!json) return null;
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) && parsed.every(Array.isArray) ? parsed : null;
  } catch {
    return null;
  }
}

function addBundleExtras(
  source: readonly (ItemBundle[] | null)[],
  compressed: string,
): string {
  const stored = parseCompressedWardrobe(compressed);
  if (!stored) return compressed;

  let changed = false;
  for (let outfitIndex = 0; outfitIndex < stored.length; outfitIndex++) {
    const sourceOutfit = source[outfitIndex];
    const storedOutfit = stored[outfitIndex];
    if (!sourceOutfit || !storedOutfit) continue;

    for (let itemIndex = 0; itemIndex < storedOutfit.length; itemIndex++) {
      const sourceItem = sourceOutfit[itemIndex];
      const tuple = storedOutfit[itemIndex];
      if (!sourceItem || !Array.isArray(tuple)) continue;
      if (tuple[0] !== sourceItem.Name || tuple[1] !== sourceItem.Group) continue;
      if (sourceItem.Difficulty == null && sourceItem.Craft == null) continue;

      const extras: WardrobeBundleExtras = {AEE: 1};
      if (sourceItem.Difficulty != null) extras.D = sourceItem.Difficulty;
      if (sourceItem.Craft != null) extras.C = sourceItem.Craft;

      const extrasIndex = tuple.findIndex(isWardrobeBundleExtras);
      if (extrasIndex >= 0) tuple[extrasIndex] = extras;
      else tuple.push(extras);
      changed = true;
    }
  }

  return changed ? LZString.compressToUTF16(JSON.stringify(stored)) : compressed;
}

function restoreBundleExtras(compressed: string, wardrobe: ItemBundle[][]) {
  const stored = parseCompressedWardrobe(compressed);
  if (!stored) return;

  for (let outfitIndex = 0; outfitIndex < stored.length; outfitIndex++) {
    const storedOutfit = stored[outfitIndex];
    const outfit = wardrobe[outfitIndex];
    if (!storedOutfit || !outfit) continue;

    for (let itemIndex = 0; itemIndex < storedOutfit.length; itemIndex++) {
      const tuple = storedOutfit[itemIndex];
      const item = outfit[itemIndex];
      if (!Array.isArray(tuple) || !item) continue;
      if (tuple[0] !== item.Name || tuple[1] !== item.Group) continue;

      const extras = tuple.find(isWardrobeBundleExtras);
      if (!isWardrobeBundleExtras(extras)) continue;
      if (extras.D != null) item.Difficulty = extras.D;
      if (extras.C != null) item.Craft = extras.C;
    }
  }
}

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
  bcAeeModSdk.hookFunction('CharacterCompressWardrobe', 0, (args, next) => {
    return addBundleExtras(args[0], next(args));
  });
  bcAeeModSdk.hookFunction('CharacterDecompressWardrobe', 0, (args, next) => {
    const wardrobe = next(args);
    if (typeof args[0] === 'string') restoreBundleExtras(args[0], wardrobe);
    return wardrobe;
  });

  installWardrobeSettingEffects();
  registerWardrobeScreen();

  bcAeeModSdk.hookFunction('TextLoad', 1, (args, next) => {
    if (!isOnWardrobeScreen()) return next(args);
    return {loadedPromise: Promise.resolve()} as unknown as TextCache;
  });

  window.Liko = window.Liko ?? {};
  window.Liko.Wardrobe = {open: enterWardrobeScreen, exit: wardrobeExit};
}
