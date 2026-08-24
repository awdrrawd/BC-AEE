import type {WardrobeSource} from '@/core/wardrobeStorage';

export type WardrobeMigrationMode = 'none' | 'aee' | 'lscg';
type LegacyTransform = 'DrawingLeft' | 'DrawingTop' | 'ScaleX' | 'ScaleY' | 'Rotation';

export interface WardrobeMigrationPart {
  bundleIndex: number;
  group: AssetGroupName;
  name: string;
  layers: number;
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

function legacyKeys(override: Record<string, unknown>): LegacyTransform[] {
  return (['DrawingLeft', 'DrawingTop', 'ScaleX', 'ScaleY', 'Rotation'] as LegacyTransform[])
    .filter(key => legacyNumber(override[key]) !== null);
}

function inspectPart(entry: ItemBundle, bundleIndex: number): WardrobeMigrationPart | null {
  const overrides = entry.Property?.LayerOverrides;
  if (!Array.isArray(overrides)) return null;
  let layers = 0;
  let supportsLscg = false;
  for (const raw of overrides) {
    if (!raw || typeof raw !== 'object') continue;
    const keys = legacyKeys(raw as unknown as Record<string, unknown>);
    if (!keys.length) continue;
    layers++;
    if (keys.includes('DrawingLeft') || keys.includes('DrawingTop')) supportsLscg = true;
  }
  return layers ? {bundleIndex, group: entry.Group, name: entry.Name, layers, supportsLscg} : null;
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
    const nativeValues: Array<[LegacyTransform, string, number]> = [];
    const left = legacyNumber(override.DrawingLeft);
    const top = legacyNumber(override.DrawingTop);
    if (left !== null) nativeValues.push(['DrawingLeft', 'TranslationX', left - layerBase(layer?.DrawingLeft)]);
    if (top !== null) nativeValues.push(['DrawingTop', 'TranslationY', top - layerBase(layer?.DrawingTop)]);
    if (mode === 'aee') {
      const scaleX = legacyNumber(override.ScaleX);
      const scaleY = legacyNumber(override.ScaleY);
      const rotation = legacyNumber(override.Rotation);
      if (scaleX !== null) nativeValues.push(['ScaleX', 'ScaleX', scaleX]);
      if (scaleY !== null) nativeValues.push(['ScaleY', 'ScaleY', scaleY]);
      if (rotation !== null) nativeValues.push(['Rotation', 'Rotation', rotation]);
    }
    for (const [legacyKey, nativeKey, value] of nativeValues) {
      const propertyKey = `Layer${nativeKey}`;
      const existing = property[propertyKey];
      const values = existing && typeof existing === 'object'
        ? existing as Record<string, number>
        : (property[propertyKey] = {}) as Record<string, number>;
      if (values[layerName] == null) values[layerName] = value;
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
      const part = inspectPart(entry, bundleIndex);
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
