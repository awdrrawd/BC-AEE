import {itemFromBundle} from './appearanceBundle';

const layerMaps = ['LayerTranslationX', 'LayerTranslationY', 'LayerScaleX', 'LayerScaleY', 'LayerRotation', 'OverridePriority'] as const;

/** Cross-group copies follow matching layers and preserve offsets from each
 * group's own origin. Copying an eye must not paste the other eye's absolute
 * position or attach index-based edits to an unrelated destination layer. */
export function copyAppearanceToGroup(character: Character, entry: ItemBundle, source: Asset, target: Asset): ItemBundle {
  const result = CommonCloneDeep({...entry, Group: target.Group.Name});
  if (source.Group.Name === target.Group.Name || !result.Property) return result;
  const property = result.Property;
  const sourceItem = itemFromBundle(character, entry);
  const targetItem = itemFromBundle(character, result);
  const sourceIndices = target.Layer.map(layer => source.Layer.findIndex(candidate =>
    (candidate.Name ?? '') === (layer.Name ?? '')));

  // R133 stores these maps in bundles as compressed strings that are indexed by the source asset's layers,
  // so read the expanded form from the decoded source item. Writing the expanded object back is valid:
  // BC accepts either form when it loads a bundle. R132 bundles already hold the objects.
  const expanded = sourceItem?.Property as Record<string, unknown> | undefined;
  const stored = property as unknown as Record<string, unknown>;
  for (const key of layerMaps) {
    const values = expanded?.[key] ?? stored[key];
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      // A compressed string that could not be expanded would be read against the wrong layers on the target.
      if (typeof stored[key] === 'string') delete stored[key];
      continue;
    }
    const mapped: Record<string, number> = {};
    target.Layer.forEach((layer, index) => {
      const sourceLayer = source.Layer[sourceIndices[index]];
      if (!sourceLayer) return;
      const name = sourceLayer.Name ?? '';
      if (Object.hasOwn(values, name)) mapped[layer.Name ?? ''] = (values as Record<string, number>)[name];
    });
    stored[key] = mapped;
  }
  if (Array.isArray(property.Opacity)) {
    const values = property.Opacity;
    property.Opacity = sourceIndices.map(index => index < 0 ? 1 : values[index] ?? values[0] ?? 1);
  }
  if (Array.isArray(property.LayerOverrides)) {
    const overrides = property.LayerOverrides;
    property.LayerOverrides = target.Layer.map((layer, index) => {
      const sourceIndex = sourceIndices[index];
      const override = CommonCloneDeep(overrides[sourceIndex] ?? {});
      for (const key of ['DrawingLeft', 'DrawingTop'] as const) {
        if (override[key] == null) continue;
        const from = layerOrigin(character, sourceItem, source.Layer[sourceIndex], key);
        const to = layerOrigin(character, targetItem, layer, key);
        if (from == null || to == null) {
          // Unknown origins must not move a destination feature to the source.
          delete override[key];
          continue;
        }
        const raw = override[key] as unknown;
        if (typeof raw === 'number') override[key] = {'': raw + to - from};
        else for (const pose of Object.keys(override[key])) {
          if (Number.isFinite(override[key][pose])) override[key][pose] += to - from;
        }
      }
      return override;
    });
  }
  return result;
}

function layerOrigin(character: Character, item: Item | null, layer: AssetLayer | undefined, key: 'DrawingLeft' | 'DrawingTop'): number | null {
  if (!item || !layer) return null;
  try {
    const point = CommonDrawComputeDrawingCoordinates(character, item.Asset, layer, item.Asset.Group.Name, item.Property);
    return key === 'DrawingLeft' ? point.X : point.Y - CanvasUpperOverflow;
  } catch {
    const value = layer[key];
    const base = typeof value === 'number' ? value : value?.[''];
    return typeof base === 'number' && Number.isFinite(base) ? base : null;
  }
}
