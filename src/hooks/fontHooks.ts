import bcAeeModSdk from '@/modsdk';
import {itemFontFamilyFor} from '@/controllers/fontController';

// The character whose appearance is currently being built, so the text-draw hooks below
// know whose font choice to apply (letting you see other players' items in their fonts).
let currentDrawChar: Character | null = null;

export function installFontHooks() {
  bcAeeModSdk.hookFunction('CommonDrawAppearanceBuild', 5, (args, next) => {
    const previous = currentDrawChar;
    currentDrawChar = args[0] ?? null;
    try {
      return next(args);
    } finally {
      currentDrawChar = previous;
    }
  });

  bcAeeModSdk.hookFunction('DynamicDrawText', 5, (args, next) => next(withFontOverride(args)));
  bcAeeModSdk.hookFunction('DynamicDrawTextArc', 5, (args, next) => next(withFontOverride(args)));
}

type TextDrawArgs =
  Parameters<typeof DynamicDrawText> | Parameters<typeof DynamicDrawTextArc>;

function withFontOverride<T extends TextDrawArgs>(args: T): T {
  const family = itemFontFamilyFor(currentDrawChar);
  if (!family) return args;
  const next = [...args] as T;
  next[4] = {...(args[4] ?? {}), fontFamily: family};
  return next;
}
