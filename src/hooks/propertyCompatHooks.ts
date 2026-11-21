import bcAeeModSdk from '@/modsdk';
import {sanitizeHideOverride, sanitizeLayerOverrides} from '@/core/propertySanitize';

/**
 * BC-R134-COMPAT
 *
 * R134 wires ItemPropertiesValidate() into ExtendedItemInit(), ValidationSanitizeProperties()
 * (every received appearance) and ItemPropertiesDecompress(), and overwrites Item.Property with
 * its return value. Only fields that have a PropertyData entry survive. AEE's LayerOverrides
 * (skew / flip / mirror-copy and the pre-R131 position fallback) and wceOverrideHide have none, so
 * they were deleted on login, room sync, opening an item dialog and wearing a wardrobe outfit.
 * Saving the appearance afterwards then wrote the loss back to the server.
 *
 * After the native validation we copy back only these two fields, and only when they pass the
 * sanitizers in core/propertySanitize.ts. Nothing is restored if BC already kept the field.
 *
 * Remove when: PropertyData gains entries for LayerOverrides / wceOverrideHide (watch for the
 * "Temporary backwards compatibility" block in ItemPropertiesGetBundleProperties disappearing).
 * On R133 and older the function is never called, so this hook is inert.
 */
export function installPropertyCompatHooks() {
  if (typeof ItemPropertiesValidate !== 'function') return;

  bcAeeModSdk.hookFunction('ItemPropertiesValidate', 5, (args, next) => {
    const ret = next(args);
    try {
      const source = args[0] as Record<string, unknown> | null | undefined;
      const family = (args[1] as {Group?: {Family?: string}} | undefined)?.Group?.Family ?? 'Female3DCG';
      const value = ret?.value as Record<string, unknown> | undefined;
      if (!value || !source || typeof source !== 'object') return ret;

      if (value.LayerOverrides === undefined && source.LayerOverrides !== undefined) {
        const layers = sanitizeLayerOverrides(source.LayerOverrides);
        if (layers) value.LayerOverrides = layers;
      }
      if (value.wceOverrideHide === undefined && source.wceOverrideHide !== undefined) {
        const hide = sanitizeHideOverride(source.wceOverrideHide, name => !!AssetGroupGet(family as IAssetFamily, name as AssetGroupName));
        if (hide) value.wceOverrideHide = hide;
      }
    } catch (error) {
      console.warn('[AEE] ItemPropertiesValidate compat restore failed:', error);
    }
    return ret;
  });
}
