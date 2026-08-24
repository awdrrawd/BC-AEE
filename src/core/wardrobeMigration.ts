import type {WardrobeSource} from '@/core/wardrobeStorage';

export type WardrobeMigrationMode = 'none' | 'aee' | 'lscg';
type LegacyTransform = 'DrawingLeft' | 'DrawingTop' | 'ScaleX' | 'ScaleY' | 'Rotation';

export interface WardrobeMigrationPart {
  bundleIndex: number;
  group: AssetGroupName;
  name: string;
  layers: number;
  supportsAee: boolean;
  supportsLscg: boolean;
}

export interface WardrobeMigrationSlot {
  index: number;
  name: string;
  before: ItemBundle[];
  after: ItemBundle[];
  changedItems: number;
  parts: WardrobeMigrationPart[];
}

function layerBase(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const raw = (value as Record<string, unknown>)[''];
    if (typeof raw === 'number') return raw;
  }
  return 0;
}

function legacyNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object') {
    const raw = (value as Record<string, unknown>)[''];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  }
  return null;
}

function nativeLayerValue(property: Record<string, unknown>, key: string, layerName: string): number | null {
  const values = property[`Layer${key}`];
  if (!values || typeof values !== 'object') return null;
  const value = (values as Record<string, unknown>)[layerName];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function itemValue(property: Record<string, unknown>, key: string): number | null {
  const value = property[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function differs(a: number, b: number): boolean {
  return Math.abs(a - b) > 0.0001;
}

function layerNeedsMode(entry: ItemBundle, asset: Asset, index: number, mode: Exclude<WardrobeMigrationMode, 'none'>): boolean {
  const property = entry.Property as (ItemProperties & Record<string, unknown>) | undefined;
  const override = property?.LayerOverrides?.[index] as unknown as Record<string, unknown> | undefined;
  if (!property || !override) return false;
  const layer = asset.Layer?.[index];
  const layerName = layer?.Name ?? asset.Name;
  const left = legacyNumber(override.DrawingLeft);
  const top = legacyNumber(override.DrawingTop);
  if (mode === 'lscg') {
    const nativeX = layerBase(layer?.DrawingLeft) + (itemValue(property, 'TranslationX') ?? 0)
      + (nativeLayerValue(property, 'TranslationX', layerName) ?? 0);
    const nativeY = layerBase(layer?.DrawingTop) + (itemValue(property, 'TranslationY') ?? 0)
      + (nativeLayerValue(property, 'TranslationY', layerName) ?? 0);
    return (left !== null && differs(left, nativeX)) || (top !== null && differs(top, nativeY));
  }

  // AEE's legacy position fallback did not run when either native translation existed.
  const aeeX = left !== null && itemValue(property, 'TranslationX') === null
    && nativeLayerValue(property, 'TranslationX', layerName) === null
    && differs(left, layerBase(layer?.DrawingLeft));
  const aeeY = top !== null && itemValue(property, 'TranslationY') === null
    && nativeLayerValue(property, 'TranslationY', layerName) === null
    && differs(top, layerBase(layer?.DrawingTop));
  const scaleX = legacyNumber(override.ScaleX);
  const scaleY = legacyNumber(override.ScaleY);
  const rotation = legacyNumber(override.Rotation);
  return aeeX || aeeY || (scaleX !== null && differs(scaleX, 1))
    || (scaleY !== null && differs(scaleY, 1)) || (rotation !== null && differs(rotation, 0));
}

function inspectPart(entry: ItemBundle, bundleIndex: number, family: IAssetFamily): WardrobeMigrationPart | null {
  const overrides = entry.Property?.LayerOverrides;
  const asset = AssetGet(family, entry.Group, entry.Name);
  if (!Array.isArray(overrides) || !asset) return null;
  let layers = 0;
  let supportsAee = false;
  let supportsLscg = false;
  for (let index = 0; index < overrides.length; index++) {
    const aee = layerNeedsMode(entry, asset, index, 'aee');
    const lscg = layerNeedsMode(entry, asset, index, 'lscg');
    if (aee || lscg) layers++;
    supportsAee ||= aee;
    supportsLscg ||= lscg;
  }
  return layers ? {bundleIndex, group: entry.Group, name: entry.Name, layers, supportsAee, supportsLscg} : null;
}

function migrateEntry(entry: ItemBundle, family: IAssetFamily, mode: Exclude<WardrobeMigrationMode, 'none'>): boolean {
  const property = entry.Property as (ItemProperties & Record<string, unknown>) | undefined;
  const overrides = property?.LayerOverrides;
  if (!property || !Array.isArray(overrides)) return false;
  const asset = AssetGet(family, entry.Group, entry.Name);
  if (!asset) return false;
  let changed = false;

  overrides.forEach((rawOverride, index) => {
    if (!rawOverride || typeof rawOverride !== 'object') return;
    const override = rawOverride as unknown as Record<string, unknown>;
    const layer = asset.Layer?.[index];
    const layerName = layer?.Name ?? asset.Name;
    if (!layerNeedsMode(entry, asset, index, mode)) return;
    const nativeValues: Array<[LegacyTransform, string, number]> = [];
    const left = legacyNumber(override.DrawingLeft);
    const top = legacyNumber(override.DrawingTop);
    const itemX = itemValue(property, 'TranslationX') ?? 0;
    const itemY = itemValue(property, 'TranslationY') ?? 0;
    if (mode === 'lscg') {
      if (left !== null) nativeValues.push(['DrawingLeft', 'TranslationX', left - layerBase(layer?.DrawingLeft) - itemX]);
      if (top !== null) nativeValues.push(['DrawingTop', 'TranslationY', top - layerBase(layer?.DrawingTop) - itemY]);
    } else {
      if (left !== null && itemValue(property, 'TranslationX') === null
        && nativeLayerValue(property, 'TranslationX', layerName) === null) {
        nativeValues.push(['DrawingLeft', 'TranslationX', left - layerBase(layer?.DrawingLeft)]);
      }
      if (top !== null && itemValue(property, 'TranslationY') === null
        && nativeLayerValue(property, 'TranslationY', layerName) === null) {
        nativeValues.push(['DrawingTop', 'TranslationY', top - layerBase(layer?.DrawingTop)]);
      }
    }
    if (mode === 'aee') {
      const scaleX = legacyNumber(override.ScaleX);
      const scaleY = legacyNumber(override.ScaleY);
      const rotation = legacyNumber(override.Rotation);
      if (scaleX !== null && differs(scaleX, 1)) nativeValues.push([
        'ScaleX', 'ScaleX', (nativeLayerValue(property, 'ScaleX', layerName) ?? 1) * scaleX,
      ]);
      if (scaleY !== null && differs(scaleY, 1)) nativeValues.push([
        'ScaleY', 'ScaleY', (nativeLayerValue(property, 'ScaleY', layerName) ?? 1) * scaleY,
      ]);
      if (rotation !== null && differs(rotation, 0)) nativeValues.push([
        'Rotation', 'Rotation', rotation - (itemValue(property, 'Rotation') ?? 0),
      ]);
    }
    for (const [legacyKey, nativeKey, value] of nativeValues) {
      const propertyKey = `Layer${nativeKey}`;
      const existing = property[propertyKey];
      const values = existing && typeof existing === 'object'
        ? existing as Record<string, number>
        : (property[propertyKey] = {}) as Record<string, number>;
      values[layerName] = value;
      delete override[legacyKey];
      changed = true;
    }
  });
  return changed;
}

export function buildWardrobeMigrationOutfit(
  slot: WardrobeMigrationSlot,
  family: IAssetFamily,
  modeForPart: (part: WardrobeMigrationPart) => WardrobeMigrationMode,
): ItemBundle[] {
  const outfit = CommonCloneDeep(slot.before) as ItemBundle[];
  for (const part of slot.parts) {
    const mode = modeForPart(part);
    if (mode !== 'none') migrateEntry(outfit[part.bundleIndex], family, mode);
  }
  return outfit;
}

export function scanWardrobeMigration(source: WardrobeSource, family: IAssetFamily): WardrobeMigrationSlot[] {
  const slots: WardrobeMigrationSlot[] = [];
  for (let index = 0; index < source.size(); index++) {
    const before = source.outfitAt(index);
    if (!before.length) continue;
    const parts = before.flatMap((entry, bundleIndex) => {
      const part = inspectPart(entry, bundleIndex, family);
      return part ? [part] : [];
    });
    if (!parts.length) continue;
    const slot: WardrobeMigrationSlot = {
      index, name: source.nameAt(index), before, after: [], changedItems: parts.length, parts,
    };
    slot.after = buildWardrobeMigrationOutfit(slot, family, () => 'aee');
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
