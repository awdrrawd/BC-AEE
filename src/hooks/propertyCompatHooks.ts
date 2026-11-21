import bcAeeModSdk from '@/modsdk';
import {sanitizeFreeDrawProperties, sanitizeHideOverride, sanitizeLayerOverrides} from '@/core/propertySanitize';
import {DRAW_ASSET, DRAW_GROUPS} from '@/components/mask-system/constants';
import {drawImageSource} from '@/components/mask-system/freeDraw/drawSource';
import {readDrawRef} from '@/components/mask-system/freeDraw/spsDrawing';

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
 * The same happened to AEE's Free Draw boards (ItemCanvas1-3/DrawingBoard): CustomDraw, CustomDrawSPS,
 * OffsetX, OffsetY and MaskPriority have no PropertyData entry either, so every received appearance and
 * every ExtendedItemInit() erased the drawing (the NOARCH Init then reset it to its baseline).
 *
 * After the native validation we copy back only these fields, and only when they pass the sanitizers
 * in core/propertySanitize.ts. The Free Draw fields are restored for AEE's own board assets only.
 * Nothing is restored if BC already kept the field.
 *
 * Remove when: PropertyData gains entries for these fields (for LayerOverrides / wceOverrideHide, watch
 * for the "Temporary backwards compatibility" block in ItemPropertiesGetBundleProperties disappearing).
 */
export function installPropertyCompatHooks() {
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

      const asset = args[1] as {Name?: string; Group?: {Name?: string}} | undefined;
      if (asset?.Name === DRAW_ASSET && DRAW_GROUPS.includes(asset.Group?.Name as never)) {
        const restored = sanitizeFreeDrawProperties(source, {
          isDrawSource: v => drawImageSource(v) !== null,
          readSpsRef: props => readDrawRef(props) as unknown as Record<string, unknown> | null,
        });
        for (const [key, v] of Object.entries(restored)) {
          if (value[key] === undefined) value[key] = v;
        }
      }
    } catch (error) {
      console.warn('[AEE] ItemPropertiesValidate compat restore failed:', error);
    }
    return ret;
  });
}
