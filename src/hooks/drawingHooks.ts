import bcAeeModSdk from '@/modsdk';
import {runtime} from '@/core/runtime';
import {withRestraintsHidden} from '@/controllers/hideRestraintsController';
import {captureAppearanceImage, invalidateAppearancePicker} from '@/controllers/appearancePickerController';
import {renderGlImage} from '@/hooks/renderHooks';
import {recordDrawImage} from '@/core/drawImageTracker';
import {withPickerMatrices} from '@/core/pickerTransform';
import {getCurrentCharacter} from '@/core/bc';
import {resolveNativeLayerTransform} from '@/core/canvasLayer';

export function installDrawingHooks() {
  bcAeeModSdk.hookFunction('CharacterLoadCanvas', 5, (args, next) => {
    const character = args[0];
    if (character === getCurrentCharacter()) invalidateAppearancePicker();
    if (character) runtime.currentRenderChar = character;
    return withRestraintsHidden(character, () => next(args));
  });

  bcAeeModSdk.hookFunction('GLDrawImage', 2, (args, next) => {
    recordDrawImage(args[0]);
    applyCanvasLayerTransform(args);
    const capture = captureAppearanceImage(args[0], args[2], args[3], args[4], args[5] ?? 0);
    return withPickerMatrices(capture?.matrices, () => renderGlImage(args, next), args[5] ?? 0);
  });
}

/**
 * Canvas-drawn layers (text) reach GLDrawImage without any transform option
 * because CommonDraw only supplies them to `drawImage(url, ...)`. Feed the same
 * values BC would have used for an image layer, including the way BC offsets
 * the draw position by the translation before GLDrawImage translates again, so
 * a text layer moves exactly like the other layers of its item.
 */
function applyCanvasLayerTransform(args: Parameters<typeof GLDrawImage>) {
  const context = runtime.afterDrawContext;
  if (!context || typeof args[0] === 'string') return;
  const options = (args[4] ?? {}) as Record<string, unknown>;
  // A future BC that already transforms these layers must not be applied twice.
  if (['TranslationX', 'TranslationY', 'ScaleX', 'ScaleY', 'Rotation'].some(key => options[key] !== undefined)) return;
  const transform = resolveNativeLayerTransform(context.item, context.layerName);
  if (!transform) return;
  args[2] += transform.tx;
  args[3] += transform.ty;
  args[4] = {
    ...options,
    TranslationX: transform.tx,
    TranslationY: transform.ty,
    ScaleX: transform.sx,
    ScaleY: transform.sy,
    Rotation: transform.rot,
  } as DrawOptions;
}
