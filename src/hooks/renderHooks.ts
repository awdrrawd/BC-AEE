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
    const savedPriority: Array<{ layer: WritableAssetLayer; original: number }> = [];
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
            savedPriority.push({layer: writableLayer, original: writableLayer.Priority});
            writableLayer.Priority = newPriority;
          }
        });
      }
    });
    const result = next(args);
    savedPriority.forEach(({layer, original}) => {
      layer.Priority = original;
    });
    character.AppearanceLayers?.forEach(layer => {
      const asset = layer.Asset?.Name;
      const group = layer.Asset?.Group?.Name;
      if (asset && group) runtime.assetGroupMap.set(asset, group);
    });
    return result;
  });

  bcAeeModSdk.hookFunction('CharacterLoadCanvas', 0, (args, next) => {
    if (args[0]) runtime.currentRenderChar = args[0];
    return next(args);
  });

  bcAeeModSdk.hookFunction('CommonDrawAppearanceBuild', 1, (args, next) => {
    const character = args[0];
    const toRestore: Array<{ asset: WritableAsset; original: boolean }> = [];
    character?.Appearance?.forEach(item => {
      const layerOverrides = item.Property?.LayerOverrides;
      const needsTransform = Array.isArray(layerOverrides) && layerOverrides.some((layerOverride: AeeLayerOverride | undefined) => layerOverride
        && (layerOverride.DrawingLeft != null || layerOverride.DrawingTop != null || layerOverride.Rotation != null
          || layerOverride.ScaleX != null || layerOverride.ScaleY != null || layerOverride.SkewX != null || layerOverride.SkewY != null
          || layerOverride.FlipX || layerOverride.FlipY || layerOverride.MirrorCopy || layerOverride.MirrorCopyV));
      const needsFlash = item === runtime.hoverFlashData?.item || item === runtime.hoverCharFlashData?.item;
      if (needsTransform || needsFlash) {
        const writableAsset = item.Asset as WritableAsset;
        toRestore.push({asset: writableAsset, original: writableAsset.DynamicBeforeDraw});
        writableAsset.DynamicBeforeDraw = true;
      }
    });
    const result = next(args);
    toRestore.forEach(({asset, original}) => {
      asset.DynamicBeforeDraw = original;
    });
    return result;
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
            || layerOverride.ScaleX != null || layerOverride.ScaleY != null || layerOverride.Rotation != null
            || layerOverride.SkewX != null || layerOverride.SkewY != null;
          if (hasTransform) {
            runtime.pendingTransform = {
              flipX: !!layerOverride.FlipX,
              flipY: !!layerOverride.FlipY,
              mirrorCopy: !!layerOverride.MirrorCopy,
              mirrorCopyV: !!layerOverride.MirrorCopyV,
              mirrorCopyAxisX: layerOverride.MirrorCopyAxisX ?? 0.5,
              mirrorCopyAxisY: layerOverride.MirrorCopyAxisY ?? 0.5,
              scaleX: layerOverride.ScaleX ?? 1,
              scaleY: layerOverride.ScaleY ?? 1,
              rotation: layerOverride.Rotation ?? 0,
              skewX: layerOverride.SkewX ?? 0,
              skewY: layerOverride.SkewY ?? 0,
            };
            aeeLog('BeforeDraw', currentAppearance.Asset?.Name, layerIdx, runtime.pendingTransform);
          }
        }
      }
    }

    const fnExists = typeof windowFunctions[funcName] === 'function';
    const ret: BeforeDrawResult = (fnExists ? (next(args) ?? {}) : {});

    const property = params.Property;
    if (currentAppearance && property) {
      let rawName = (params.L ?? '').trim();
      if (rawName[0] === '_') rawName = rawName.slice(1);
      const layerIdx = resolveDrawLayerIndex(currentAppearance, rawName);
      if (layerIdx >= 0) {
        const layerOverride = property?.LayerOverrides?.[layerIdx];
        if (layerOverride) {
          const dx = layerOverride.DrawingLeft?.[''];
          const dy = layerOverride.DrawingTop?.[''];
          if (dx != null && ret.X == null) ret.X = dx;
          if (dy != null && ret.Y == null) ret.Y = dy + CanvasUpperOverflow;
        }
      }
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

function installWebGlPrototypePatch() {
  if (runtime.originalUniformMatrix4fv || !window.WebGL2RenderingContext) return;
  runtime.originalUniformMatrix4fv = WebGL2RenderingContext.prototype.uniformMatrix4fv;
  runtime.originalDrawArrays = WebGL2RenderingContext.prototype.drawArrays;

  WebGL2RenderingContext.prototype.uniformMatrix4fv = function (location, transpose, data) {
    if (data instanceof Float32Array && data.length === 16 && runtime.pendingTransform) {
      const transformData = runtime.pendingTransform;
      runtime.pendingTransformApplied++;
      if (runtime.pendingTransformApplied >= 2) {
        runtime.pendingTransform = null;
        runtime.pendingTransformApplied = 0;
      }

      const matrix = new Float32Array(data);
      if (transformData.rotation !== 0 || transformData.scaleX !== 1 || transformData.scaleY !== 1) {
        const old0 = matrix[0], old1 = matrix[1], old4 = matrix[4], old5 = matrix[5];
        const rad = -transformData.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const sx = Math.sqrt(old0 ** 2 + old1 ** 2) * transformData.scaleX;
        const sy = Math.sqrt(old4 ** 2 + old5 ** 2) * transformData.scaleY;
        const sgx = old0 < 0 ? -1 : 1;
        const sgy = old5 < 0 ? -1 : 1;
        matrix[0] = cos * sx * sgx;
        matrix[1] = sin * sx * sgx;
        matrix[4] = -sin * sy * sgy;
        matrix[5] = cos * sy * sgy;
        matrix[12] -= 0.5 * (matrix[0] + matrix[4] - old0 - old4);
        matrix[13] -= 0.5 * (matrix[1] + matrix[5] - old1 - old5);
      }

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

      if (transformData.flipX) {
        matrix[12] += matrix[0];
        matrix[13] += matrix[1];
        matrix[0] = -matrix[0];
        matrix[1] = -matrix[1];
      }
      if (transformData.flipY) {
        matrix[12] += matrix[4];
        matrix[13] += matrix[5];
        matrix[4] = -matrix[4];
        matrix[5] = -matrix[5];
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
