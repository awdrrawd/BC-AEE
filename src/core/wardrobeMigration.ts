import type {WardrobeSource} from '@/core/wardrobeStorage';

type LegacyTransform = 'DrawingLeft' | 'DrawingTop' | 'ScaleX' | 'ScaleY' | 'Rotation';

export interface WardrobeMigrationSlot {
  index: number;
  name: string;
  before: ItemBundle[];
  after: ItemBundle[];
  changedItems: number;
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

/** Converts AEE's pre-R131 render-time transforms into BC's native per-layer properties. */
export function migrateOutfitToR131(outfit: readonly ItemBundle[], family: IAssetFamily): {
  outfit: ItemBundle[];
  changedItems: number;
} {
  const migrated = CommonCloneDeep(outfit) as ItemBundle[];
  let changedItems = 0;

  for (const entry of migrated) {
    const property = entry.Property as (ItemProperties & Record<string, unknown>) | undefined;
    const overrides = property?.LayerOverrides;
    if (!property || !Array.isArray(overrides)) continue;

    const asset = AssetGet(family, entry.Group, entry.Name);
    if (!asset) continue;
    let itemChanged = false;

    overrides.forEach((rawOverride, index) => {
      if (!rawOverride || typeof rawOverride !== 'object') return;
      const override = rawOverride as unknown as Record<string, unknown>;
      const layer = asset.Layer?.[index];
      const layerName = layer?.Name ?? asset.Name;
      const nativeValues: Array<[LegacyTransform, string, number]> = [];

      const left = legacyNumber(override.DrawingLeft);
      const top = legacyNumber(override.DrawingTop);
      const scaleX = legacyNumber(override.ScaleX);
      const scaleY = legacyNumber(override.ScaleY);
      const rotation = legacyNumber(override.Rotation);
      if (left !== null) nativeValues.push(['DrawingLeft', 'TranslationX', left - layerBase(layer?.DrawingLeft)]);
      if (top !== null) nativeValues.push(['DrawingTop', 'TranslationY', top - layerBase(layer?.DrawingTop)]);
      if (scaleX !== null) nativeValues.push(['ScaleX', 'ScaleX', scaleX]);
      if (scaleY !== null) nativeValues.push(['ScaleY', 'ScaleY', scaleY]);
      if (rotation !== null) nativeValues.push(['Rotation', 'Rotation', rotation]);

      for (const [legacyKey, nativeKey, value] of nativeValues) {
        const propertyKey = `Layer${nativeKey}`;
        const existing = property[propertyKey];
        const values = existing && typeof existing === 'object'
          ? existing as Record<string, number>
          : (property[propertyKey] = {}) as Record<string, number>;
        if (values[layerName] == null) values[layerName] = value;
        delete override[legacyKey];
        itemChanged = true;
      }
    });

    if (itemChanged) changedItems++;
  }

  return {outfit: migrated, changedItems};
}

export function scanWardrobeMigration(source: WardrobeSource, family: IAssetFamily): WardrobeMigrationSlot[] {
  const slots: WardrobeMigrationSlot[] = [];
  for (let index = 0; index < source.size(); index++) {
    const before = source.outfitAt(index);
    if (!before.length) continue;
    const result = migrateOutfitToR131(before, family);
    if (!result.changedItems) continue;
    slots.push({index, name: source.nameAt(index), before, after: result.outfit, changedItems: result.changedItems});
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
