import type {WardrobeSource} from '@/core/wardrobeStorage';

type LegacyTransform = 'DrawingLeft' | 'DrawingTop' | 'ScaleX' | 'ScaleY' | 'Rotation';
const BC_WEBGL_TRANSLATION_FACTOR = 2;

export interface WardrobeMigrationPart {
  bundleIndex: number;
  group: AssetGroupName;
  name: string;
  layers: number;
}

export interface WardrobeMigrationSlot {
  index: number;
  name: string;
  before: ItemBundle[];
  after: ItemBundle[];
  changedItems: number;
  parts: WardrobeMigrationPart[];
}

function legacyNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const raw = (value as Record<string, unknown>)[PoseType.DEFAULT];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  }
  return null;
}

function propertyNumber(property: Record<string, unknown>, key: string): number {
  const value = property[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function hasLayerValue(property: Record<string, unknown>, key: string, layerName: string): boolean {
  const values = property[`Layer${key}`];
  return !!values && typeof values === 'object'
    && typeof (values as Record<string, unknown>)[layerName] === 'number';
}

function originalLayerPositions(character: Character, asset: Asset, property: Record<string, unknown>) {
  const item = {Asset: asset, Property: CommonCloneDeep(property)} as Item;
  const left = PropertyLayerOrigin.getOriginal(item, 'DrawingLeft');
  const top = PropertyLayerOrigin.getOriginal(item, 'DrawingTop');
  // CharacterPreview renders wardrobe cards in the default pose. Resolve the
  // migration against that same pose without mutating the live character;
  // otherwise opening this dialog while kneeling would bake pose movement into
  // every migrated outfit.
  const coordinateCharacter = Object.create(character) as Character;
  coordinateCharacter.DrawPose = [];
  return asset.Layer.map(layer => {
    // PropertyLayerOrigin indexes an unnamed asset layer with "", while BC's
    // native LayerTranslation* properties address that same layer by the asset
    // name. Keep the lookup key and persistence key separate; using the asset
    // name for both made the origin lookup fall back to zero and added the
    // asset's original absolute position a second time during migration.
    const originKey = layer.Name ?? '';
    const name = layer.Name ?? asset.Name;
    let x = legacyNumber(left[originKey]) ?? legacyNumber(layer.DrawingLeft) ?? 0;
    let y = legacyNumber(top[originKey]) ?? legacyNumber(layer.DrawingTop) ?? 0;
    try {
      // This is the exact coordinate BC adds native TranslationX/Y to. The
      // legacy AEE hook replaced X directly and replaced Y after adding
      // CanvasUpperOverflow, so remove that common overflow from the Y base.
      // Using only AssetLayer.DrawingLeft/Top misses pose movement, body-style
      // draw offsets, fixed-position correction and extended-item origins.
      const coordinates = CommonDrawComputeDrawingCoordinates(
        coordinateCharacter, asset, layer, asset.Group.Name, property,
      );
      x = coordinates.X;
      y = coordinates.Y - CanvasUpperOverflow;
    } catch {
      // Some incomplete preview characters cannot resolve BodyStyle.DrawOffset;
      // the official layer origin above remains a safe fallback.
    }
    return {
      name,
      x,
      y,
    };
  });
}

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > 0.0001;
}

/**
 * BC currently applies TranslationX/Y twice on its WebGL path: once when it
 * builds drawX/drawY in CommonDraw, and once again in GLDraw's transform
 * matrix. Convert the legacy absolute coordinate into the native value that
 * produces the same final draw position.
 */
function nativeTranslation(legacyAbsolute: number, base: number, itemTranslation: number): number {
  return (legacyAbsolute - base) / BC_WEBGL_TRANSLATION_FACTOR - itemTranslation;
}

function nativeRenderedPosition(base: number, itemTranslation: number): number {
  return base + BC_WEBGL_TRANSLATION_FACTOR * itemTranslation;
}

function migratableLayerCount(entry: ItemBundle, character: Character): number {
  const property = entry.Property as (ItemProperties & Record<string, unknown>) | undefined;
  const overrides = property?.LayerOverrides;
  const asset = AssetGet(character.AssetFamily, entry.Group, entry.Name);
  if (!property || !Array.isArray(overrides) || !asset) return 0;
  let origins: ReturnType<typeof originalLayerPositions>;
  try { origins = originalLayerPositions(character, asset, property); } catch { return 0; }
  let count = 0;
  overrides.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || !origins[index]) return;
    const override = raw as unknown as Record<string, unknown>;
    const origin = origins[index];
    const left = legacyNumber(override.DrawingLeft);
    const top = legacyNumber(override.DrawingTop);
    const position = (left !== null && !hasLayerValue(property, 'TranslationX', origin.name)
        && differs(left, nativeRenderedPosition(origin.x, propertyNumber(property, 'TranslationX'))))
      || (top !== null && !hasLayerValue(property, 'TranslationY', origin.name)
        && differs(top, nativeRenderedPosition(origin.y, propertyNumber(property, 'TranslationY'))));
    const scaleX = legacyNumber(override.ScaleX);
    const scaleY = legacyNumber(override.ScaleY);
    const rotation = legacyNumber(override.Rotation);
    const transform = (scaleX !== null && differs(scaleX, 1) && !hasLayerValue(property, 'ScaleX', origin.name))
      || (scaleY !== null && differs(scaleY, 1) && !hasLayerValue(property, 'ScaleY', origin.name))
      || (rotation !== null && differs(rotation, 0) && !hasLayerValue(property, 'Rotation', origin.name));
    if (position || transform) count++;
  });
  return count;
}

function migrateEntry(entry: ItemBundle, character: Character): boolean {
  const property = entry.Property as (ItemProperties & Record<string, unknown>) | undefined;
  const overrides = property?.LayerOverrides;
  const asset = AssetGet(character.AssetFamily, entry.Group, entry.Name);
  if (!property || !Array.isArray(overrides) || !asset) return false;
  let origins: ReturnType<typeof originalLayerPositions>;
  try { origins = originalLayerPositions(character, asset, property); } catch { return false; }
  let changed = false;

  overrides.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || !origins[index]) return;
    const override = raw as unknown as Record<string, unknown>;
    const origin = origins[index];
    const values: Array<[LegacyTransform, string, number]> = [];
    const left = legacyNumber(override.DrawingLeft);
    const top = legacyNumber(override.DrawingTop);
    if (left !== null && !hasLayerValue(property, 'TranslationX', origin.name)
      && differs(left, nativeRenderedPosition(origin.x, propertyNumber(property, 'TranslationX')))) {
      values.push(['DrawingLeft', 'TranslationX', nativeTranslation(
        left, origin.x, propertyNumber(property, 'TranslationX'),
      )]);
    }
    if (top !== null && !hasLayerValue(property, 'TranslationY', origin.name)
      && differs(top, nativeRenderedPosition(origin.y, propertyNumber(property, 'TranslationY')))) {
      values.push(['DrawingTop', 'TranslationY', nativeTranslation(
        top, origin.y, propertyNumber(property, 'TranslationY'),
      )]);
    }
    const scaleX = legacyNumber(override.ScaleX);
    const scaleY = legacyNumber(override.ScaleY);
    const rotation = legacyNumber(override.Rotation);
    if (scaleX !== null && differs(scaleX, 1) && !hasLayerValue(property, 'ScaleX', origin.name)) {
      values.push(['ScaleX', 'ScaleX', scaleX]);
    }
    if (scaleY !== null && differs(scaleY, 1) && !hasLayerValue(property, 'ScaleY', origin.name)) {
      values.push(['ScaleY', 'ScaleY', scaleY]);
    }
    if (rotation !== null && differs(rotation, 0) && !hasLayerValue(property, 'Rotation', origin.name)) {
      values.push(['Rotation', 'Rotation', rotation - propertyNumber(property, 'Rotation')]);
    }
    for (const [legacyKey, nativeKey, value] of values) {
      const propertyKey = `Layer${nativeKey}`;
      const layerValues = property[propertyKey] && typeof property[propertyKey] === 'object'
        ? property[propertyKey] as Record<string, number>
        : (property[propertyKey] = {}) as Record<string, number>;
      layerValues[origin.name] = value;
      delete override[legacyKey];
      changed = true;
    }
  });
  return changed;
}

export function buildWardrobeMigrationOutfit(
  slot: WardrobeMigrationSlot,
  character: Character,
  selected: (part: WardrobeMigrationPart) => boolean,
): ItemBundle[] {
  const outfit = CommonCloneDeep(slot.before) as ItemBundle[];
  for (const part of slot.parts) if (selected(part)) migrateEntry(outfit[part.bundleIndex], character);
  return outfit;
}

export function scanWardrobeMigration(source: WardrobeSource, character: Character): WardrobeMigrationSlot[] {
  const slots: WardrobeMigrationSlot[] = [];
  for (let index = 0; index < source.size(); index++) {
    const before = source.outfitAt(index);
    if (!before.length) continue;
    const parts = before.flatMap((entry, bundleIndex) => {
      const layers = migratableLayerCount(entry, character);
      return layers ? [{bundleIndex, group: entry.Group, name: entry.Name, layers}] : [];
    });
    if (!parts.length) continue;
    const slot: WardrobeMigrationSlot = {
      index, name: source.nameAt(index), before, after: [], changedItems: parts.length, parts,
    };
    slot.after = buildWardrobeMigrationOutfit(slot, character, () => true);
    slots.push(slot);
  }
  return slots;
}

export function applyWardrobeMigration(source: WardrobeSource, slots: readonly WardrobeMigrationSlot[]): boolean {
  const snapshots = slots.map(slot => ({index: slot.index, outfit: source.outfitAt(slot.index), name: source.nameAt(slot.index)}));
  for (const slot of slots) source.writeSlot(slot.index, slot.after, slot.name);
  if (source.persist(slots.map(slot => slot.index))) return true;
  for (const snapshot of snapshots) source.writeSlot(snapshot.index, snapshot.outfit, snapshot.name);
  return false;
}
