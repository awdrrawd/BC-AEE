import bcAeeModSdk from '@/modsdk';
import {runtime} from '@/core/runtime';
import {withRestraintsHidden} from '@/controllers/hideRestraintsController';
import {captureAppearanceImage, invalidateAppearancePicker} from '@/controllers/appearancePickerController';
import {renderGlImage} from '@/hooks/renderHooks';

export function installDrawingHooks() {
  bcAeeModSdk.hookFunction('CharacterLoadCanvas', 5, (args, next) => {
    const character = args[0];
    if (character === CharacterAppearanceSelection) invalidateAppearancePicker();
    if (character) runtime.currentRenderChar = character;
    return withRestraintsHidden(character, () => next(args));
  });

  bcAeeModSdk.hookFunction('GLDrawImage', 2, (args, next) => {
    captureAppearanceImage(args[0], args[2], args[3], args[4]);
    return renderGlImage(args, next);
  });
}
