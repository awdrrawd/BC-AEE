import bcAeeModSdk from '@/modsdk';
import {runtime} from '@/core/runtime';
import type {
  AeeLayerOverride,
  BeforeDrawParams,
  BeforeDrawResult,
  WritableAsset,
  WritableAssetLayer
} from '@/core/types';

const AEE_DEBUG = false;

function aeeLog(...args: unknown[]) {
  if (AEE_DEBUG) console.log('[AEE]', ...args);
}

const windowFunctions = window as unknown as Record<string, unknown>;

function resolveDrawLayerIndex(currentAppearance: Item, rawName: string): number {
  if (runtime.currentDrawLayerItem === currentAppearance
    && runtime.currentDrawLayerIndex != null
    && runtime.currentDrawLayerIndex >= 0) {
    const layer = currentAppearance.Asset?.Layer?.[runtime.currentDrawLayerIndex];
    if (layer && (layer.Name ?? '') === rawName) return runtime.currentDrawLayerIndex;
  }
  return currentAppearance.Asset?.Layer?.findIndex(layer => (layer.Name ?? '') === rawName) ?? -1;
}

export function installRenderHooks() {
  installWebGlPrototypePatch();

  bcAeeModSdk.hookFunction('CommonDrawResolveLayerColor', 0, (args, next) => {
    const item = args[1];
    const layer = args[2];
    if (item?.Asset?.Layer && layer) {
      runtime.currentDrawLayerItem = item;
      runtime.currentDrawLayerIndex = item.Asset.Layer.indexOf(layer);
    } else {
      runtime.currentDrawLayerItem = null;
      runtime.currentDrawLayerIndex = null;
    }
    return next(args);
  });

  bcAeeModSdk.hookFunction('GLDrawAppearanceBuild', 1, (args, next) => {
    const character = args[0];
    runtime.currentRenderChar = character;
    const savedPriority = new Map<WritableAssetLayer, number>();
    character.Appearance?.forEach(item => {
      const assetLayers = item.Asset?.Layer;
      const override = item.Property?.OverridePriority;
      if (override != null) {
        assetLayers?.forEach(layer => {
          const newPriority = typeof override === 'number'
            ? override
            : (typeof override === 'object' && override[layer.Name ?? ''] != null ? override[layer.Name ?? ''] : null);
          if (newPriority != null) {
            const writableLayer = layer as WritableAssetLayer;
            if (!savedPriority.has(writableLayer)) savedPriority.set(writableLayer, writableLayer.Priority);
            writableLayer.Priority = newPriority;
          }
        });
      }
    });
    let result: ReturnType<typeof next>;
    try {
      result = next(args);
    } finally {
      savedPriority.forEach((original, layer) => {
        layer.Priority = original;
      });
    }
    character.AppearanceLayers?.forEach(layer => {
      const asset = layer.Asset?.Name;
      const group = layer.Asset?.Group?.Name;
      if (asset && group) runtime.assetGroupMap.set(asset, group);
    });
    return result;
  });

  bcAeeModSdk.hookFunction('CommonDrawAppearanceBuild', 1, (args, next) => {
    const character = args[0];
    const toRestore = new Map<WritableAsset, boolean>();
    character?.Appearance?.forEach(item => {
      const layerOverrides = item.Property?.LayerOverrides;
      const needsTransform = Array.isArray(layerOverrides) && layerOverrides.some((layerOverride: AeeLayerOverride | undefined) => layerOverride
        && (layerOverride.SkewX != null || layerOverride.SkewY != null
          || layerOverride.FlipX || layerOverride.FlipY || layerOverride.MirrorCopy || layerOverride.MirrorCopyV));
      const needsFlash = item === runtime.hoverFlashData?.item || item === runtime.hoverCharFlashData?.item;
      if (needsTransform || needsFlash) {
        const writableAsset = item.Asset as WritableAsset;
        if (!toRestore.has(writableAsset)) toRestore.set(writableAsset, writableAsset.DynamicBeforeDraw);
        writableAsset.DynamicBeforeDraw = true;
      }
    });
    try {
      return next(args);
    } finally {
      toRestore.forEach((original, asset) => {
        asset.DynamicBeforeDraw = original;
      });
    }
  });

  bcAeeModSdk.hookFunction('CommonCallFunctionByNameWarn', 3, (args, next) => {
    const funcName = args[0];
    const params: BeforeDrawParams | undefined = args[1];
    if (!params || !/Assets(.+)BeforeDraw/i.test(funcName)) return next(args);

    runtime.pendingTransform = null;
    runtime.pendingTransformApplied = 0;
    const currentAppearance = params.CA;

    if (currentAppearance) {
      let layerName = (params.L ?? '').trim();
      if (layerName[0] === '_') layerName = layerName.slice(1);
      const layerIdx = resolveDrawLayerIndex(currentAppearance, layerName);
      if (layerIdx >= 0) {
        const layerOverride = currentAppearance.Property?.LayerOverrides?.[layerIdx];
        if (layerOverride) {
          const hasTransform = layerOverride.FlipX || layerOverride.FlipY || layerOverride.MirrorCopy || layerOverride.MirrorCopyV
            || layerOverride.SkewX != null || layerOverride.SkewY != null;
          if (hasTransform) {
            runtime.pendingTransform = {
              flipX: !!layerOverride.FlipX,
              flipY: !!layerOverride.FlipY,
              mirrorCopy: !!layerOverride.MirrorCopy,
              mirrorCopyV: !!layerOverride.MirrorCopyV,
              mirrorCopyAxisX: layerOverride.MirrorCopyAxisX ?? 0.5,
              mirrorCopyAxisY: layerOverride.MirrorCopyAxisY ?? 0.5,
              skewX: layerOverride.SkewX ?? 0,
              skewY: layerOverride.SkewY ?? 0,
            };
            aeeLog('BeforeDraw', currentAppearance.Asset?.Name, layerIdx, runtime.pendingTransform);
          }
        }
      }
    }

    // Keep the ModSDK chain intact even when the asset has no native
    // BeforeDraw function. LSCG deliberately supplies X/Y from its downstream
    // CommonCallFunctionByNameWarn hook for such assets; skipping `next` here
    // left its LayerOverrides changing numerically without affecting drawing.
    // A scoped no-op prevents BC's missing-function warning while still giving
    // every compatibility hook a chance to contribute to the result.
    const fnExists = typeof windowFunctions[funcName] === 'function';
    if (!fnExists) windowFunctions[funcName] = () => ({});
    let ret: BeforeDrawResult;
    try {
      ret = next(args) ?? {};
    } finally {
      if (!fnExists) delete windowFunctions[funcName];
    }

    if (currentAppearance) {
      let rawName = (params.L ?? '').trim();
      if (rawName[0] === '_') rawName = rawName.slice(1);
      const layerIdx = resolveDrawLayerIndex(currentAppearance, rawName);
      if (layerIdx >= 0) {
        if (runtime.hoverFlashData?.item === currentAppearance && runtime.hoverFlashData.overrides.has(layerIdx)) {
          ret.Opacity = runtime.hoverFlashData.overrides.get(layerIdx);
        } else if (runtime.hoverCharFlashData?.item === currentAppearance && runtime.hoverCharFlashData.overrides.has(layerIdx)) {
          ret.Opacity = runtime.hoverCharFlashData.overrides.get(layerIdx);
        }
      }
    }

    return ret;
  });
}

// GLDrawImage is the stable boundary where BC owns translation, rotation and
// scaling natively. AEE only adds flip plus the scoped skew/mirror transform.
export function renderGlImage(
  args: Parameters<typeof GLDrawImage>,
  next: (args: Parameters<typeof GLDrawImage>) => ReturnType<typeof GLDrawImage>,
) {
  const transform = runtime.pendingTransform;
  if (!transform) return next(args);

  const options = {...((args[4] as Record<string, unknown> | undefined) ?? {})};
  const scaleX = typeof options.ScaleX === 'number' ? options.ScaleX : 1;
  const scaleY = typeof options.ScaleY === 'number' ? options.ScaleY : 1;
  if (transform.flipX) options.ScaleX = -scaleX;
  if (transform.flipY) options.ScaleY = -scaleY;
  args[4] = options as DrawOptions;

  runtime.activeSkewTransform = transform;
  runtime.pendingTransformApplied++;
  try {
    return next(args);
  } finally {
    runtime.activeSkewTransform = null;
    // CommonDraw emits the normal and blink image consecutively for a layer.
    if (runtime.pendingTransformApplied >= 2) {
      runtime.pendingTransform = null;
      runtime.pendingTransformApplied = 0;
    }
  }
}

function installWebGlPrototypePatch() {
  if (runtime.originalUniformMatrix4fv || !window.WebGL2RenderingContext) return;
  runtime.originalUniformMatrix4fv = WebGL2RenderingContext.prototype.uniformMatrix4fv;
  runtime.originalDrawArrays = WebGL2RenderingContext.prototype.drawArrays;

  WebGL2RenderingContext.prototype.uniformMatrix4fv = function (location, transpose, data) {
    if (data instanceof Float32Array && data.length === 16 && runtime.activeSkewTransform) {
      const transformData = runtime.activeSkewTransform;

      const matrix = new Float32Array(data);
      if (transformData.skewX !== 0 || transformData.skewY !== 0) {
        const bx0 = matrix[0], by0 = matrix[1], bx4 = matrix[4], by5 = matrix[5];
        if (transformData.skewX !== 0) {
          const tx = Math.tan(transformData.skewX * Math.PI / 180);
          matrix[4] += tx * bx0;
          matrix[5] += tx * by0;
          matrix[12] -= 0.5 * tx * bx0;
          matrix[13] -= 0.5 * tx * by0;
        }
        if (transformData.skewY !== 0) {
          const ty = Math.tan(transformData.skewY * Math.PI / 180);
          matrix[0] += ty * bx4;
          matrix[1] += ty * by5;
          matrix[12] -= 0.5 * ty * bx4;
          matrix[13] -= 0.5 * ty * by5;
        }
      }

      if (transformData.mirrorCopy || transformData.mirrorCopyV) {
        runtime.lastMatrixData = matrix;
        runtime.lastMatrixLocation = location;
        runtime.lastGl = this;
        runtime.mirrorCopyFlags = {
          x: !!transformData.mirrorCopy,
          y: !!transformData.mirrorCopyV,
          axisX: transformData.mirrorCopyAxisX ?? 0.5,
          axisY: transformData.mirrorCopyAxisY ?? 0.5,
        };
      } else {
        runtime.mirrorCopyFlags = null;
      }

      return runtime.originalUniformMatrix4fv!.call(this, location, transpose, matrix);
    }

    return runtime.originalUniformMatrix4fv!.call(this, location, transpose, data);
  };

  WebGL2RenderingContext.prototype.drawArrays = function (mode, first, count) {
    const result = runtime.originalDrawArrays!.call(this, mode, first, count);
    if (runtime.mirrorCopyFlags && runtime.lastMatrixData && runtime.lastMatrixLocation && runtime.lastGl === this) {
      const matrix = new Float32Array(runtime.lastMatrixData);
      if (runtime.mirrorCopyFlags.x) {
        const dx = matrix[0] * (1 - 2 * runtime.mirrorCopyFlags.axisX);
        matrix[12] += dx;
        matrix[0] = -matrix[0];
        matrix[1] = -matrix[1];
      }
      if (runtime.mirrorCopyFlags.y) {
        const dy = matrix[5] * (1 - 2 * runtime.mirrorCopyFlags.axisY);
        matrix[13] += dy;
        matrix[4] = -matrix[4];
        matrix[5] = -matrix[5];
      }
      runtime.originalUniformMatrix4fv!.call(this, runtime.lastMatrixLocation, false, matrix);
      runtime.originalDrawArrays!.call(this, mode, first, count);
      runtime.originalUniformMatrix4fv!.call(this, runtime.lastMatrixLocation, false, runtime.lastMatrixData);
    }
    runtime.mirrorCopyFlags = null;
    return result;
  };
}
