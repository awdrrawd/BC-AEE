import {wardrobeMutation, wardrobeIdentity} from './wardrobeMutation';
import type {WardrobeSource} from '@/core/wardrobeStorage';

type LegacyTransform = 'DrawingLeft' | 'DrawingTop' | 'ScaleX' | 'ScaleY' | 'Rotation';
const BC_WEBGL_TRANSLATION_FACTOR = 2;

export interface WardrobeMigrationPart {
  bundleIndex: number;
  group: AssetGroupName;
  name: string;
  layers: number;
  fields: string[];
  conflict?: boolean;
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
  const item: Item = {Asset: asset, Property: CommonCloneDeep(property), Color: ['Default'], Difficulty: 0};
  const left = PropertyLayerOrigin.getOriginal(item, 'DrawingLeft');
  const top = PropertyLayerOrigin.getOriginal(item, 'DrawingTop');
  // CharacterPreview renders wardrobe cards in the default pose. Resolve the
  // migration against that same pose without mutating the live character;
  // otherwise opening this dialog while kneeling would bake pose movement into
  // every migrated outfit.
  const coordinateCharacter = Object.create(character) as Character;
  coordinateCharacter.DrawPose = [];
  return asset.Layer.map(layer => {
    // R132 uses the empty key for unnamed layers in both APIs.
    const originKey = layer.Name ?? '';
    const name = originKey;
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

const NATIVE_LAYER_FIELDS = ['LayerTranslationX', 'LayerTranslationY', 'LayerScaleX', 'LayerScaleY', 'LayerRotation'] as const;

function migrateNativeKeys(entry: ItemBundle, asset: Asset | null): {fields: string[]; conflict: boolean} {
  const property = entry.Property;
  const fields = NATIVE_LAYER_FIELDS.filter(key => {
    const map = property?.[key];
    return map && Object.hasOwn(map, entry.Name);
  });
  if (!asset && Array.isArray(property?.LayerOverrides)
    && property.LayerOverrides.some(layer => layer && ['DrawingLeft', 'DrawingTop', 'ScaleX', 'ScaleY', 'Rotation']
      .some(key => legacyNumber((layer as unknown as Record<string, unknown>)[key]) !== null))) {
    return {fields: [...fields, 'LayerOverrides'], conflict: true};
  }
  if (!fields.length) return {fields: [], conflict: false};
  if (!asset) return {fields, conflict: true};
  if (!asset.Layer.some(layer => layer.Name == null)) return {fields: [], conflict: false};
  // An actual named layer may own the old key. Never guess or overwrite a
  // newer value, even if one field would otherwise be safe to migrate.
  if (asset.Layer.some(layer => layer.Name === entry.Name)
    || fields.some(key => Object.hasOwn(property![key]!, '')
      || !Number.isFinite(property![key]![entry.Name]))) return {fields, conflict: true};
  for (const key of fields) {
    const map = property![key]!;
    map[''] = map[entry.Name];
    delete map[entry.Name];
  }
  return {fields, conflict: false};
}

function migrateEntry(entry: ItemBundle, character: Character): {layers: number; fields: string[]; conflict?: boolean} {
  const property = entry.Property as (ItemProperties & Record<string, unknown>) | undefined;
  const overrides = property?.LayerOverrides;
  const asset = AssetGet(character.AssetFamily, entry.Group, entry.Name);
  const native = migrateNativeKeys(entry, asset);
  const renamedUnnamedLayer = native.fields.length > 0;
  const result = {layers: renamedUnnamedLayer ? 1 : 0, ...native};
  if (native.conflict || !property || !Array.isArray(overrides) || !asset) return result;
  let origins: ReturnType<typeof originalLayerPositions>;
  try { origins = originalLayerPositions(character, asset, property); } catch { return result; }

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
    if (values.length && !(renamedUnnamedLayer && asset.Layer[index].Name == null)) result.layers++;
    for (const [legacyKey, nativeKey, value] of values) {
      const propertyKey = `Layer${nativeKey}`;
      const layerValues = property[propertyKey] && typeof property[propertyKey] === 'object'
        ? property[propertyKey] as Record<string, number>
        : (property[propertyKey] = {}) as Record<string, number>;
      layerValues[origin.name] = value;
      delete override[legacyKey];
      if (!result.fields.includes(propertyKey)) result.fields.push(propertyKey);
    }
  });
  return result;
}

export function buildWardrobeMigrationOutfit(
  slot: WardrobeMigrationSlot,
  character: Character,
  selected: (part: WardrobeMigrationPart) => boolean,
): ItemBundle[] {
  const outfit = CommonCloneDeep(slot.before) as ItemBundle[];
  for (const part of slot.parts) if (!part.conflict && selected(part)) migrateEntry(outfit[part.bundleIndex], character);
  return outfit;
}

export function scanWardrobeMigration(source: WardrobeSource, character: Character): WardrobeMigrationSlot[] {
  const slots: WardrobeMigrationSlot[] = [];
  for (let index = 0; index < source.size(); index++) {
    const before = CommonCloneDeep(source.outfitAt(index));
    if (!before.length) continue;
    const parts = before.flatMap((entry, bundleIndex) => {
      const result = migrateEntry(CommonCloneDeep(entry), character);
      return result.layers ? [{bundleIndex, group: entry.Group, name: entry.Name, ...result}] : [];
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

export async function applyWardrobeMigration(source: WardrobeSource, slots: readonly WardrobeMigrationSlot[]): Promise<boolean> {
  return wardrobeMutation(false, async () => {
    const current = wardrobeIdentity();
    if (slots.some(slot => source.nameAt(slot.index) !== slot.name
      || JSON.stringify(source.outfitAt(slot.index)) !== JSON.stringify(slot.before))) return false;
    const snapshots = slots.map(slot => ({index: slot.index, outfit: source.outfitAt(slot.index), name: source.nameAt(slot.index)}));
    for (const slot of slots) source.writeSlot(slot.index, slot.after, slot.name);
    try { if (await source.persist(slots.map(slot => slot.index))) return current(); }
    catch (error) { console.warn(error); }
    if (!current()) return false;
    for (const snapshot of snapshots) source.writeSlot(snapshot.index, snapshot.outfit, snapshot.name);
    return false;
  }, source);
}
