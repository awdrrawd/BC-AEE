import type {WardrobeSource} from './wardrobeStorage';

export interface DrawingMigrationSlot {index: number; name: string; before: ItemBundle[]; count: number}
// Only migrate AEE drawing boards; arbitrary third-party CustomDraw properties are untouched.
const drawingGroups = ['ItemCanvas1', 'ItemCanvas2', 'ItemCanvas3'];
function drawingSlot(group: string): number { return drawingGroups.indexOf(group); }
export function scanWardrobeDrawings(source: WardrobeSource): DrawingMigrationSlot[] {
  const result: DrawingMigrationSlot[] = [];
  for (let index = 0; index < source.size(); index++) {
    const outfit = source.outfitAt(index);
    const count = outfit.filter(entry => drawingSlot(entry.Group) >= 0 && entry.Name === 'DrawingBoard'
      && typeof (entry.Property as Record<string, unknown> | undefined)?.CustomDraw === 'string'
      && !!(entry.Property as Record<string, unknown>).CustomDraw).length;
    if (count) result.push({index, name: source.nameAt(index), before: structuredClone(outfit), count});
  }
  return result;
}
/** Prepare all replacements without changing the wardrobe. Caller owns backup, lock and commit. */
export async function prepareWardrobeDrawings(
  plan: readonly DrawingMigrationSlot[],
  upload: (slot: number, embedded: string) => Promise<unknown>,
  check: () => void,
) {
  const prepared = [];
  const shared = new Map<string, unknown>();
  for (const row of plan) {
    check();
    const outfit = structuredClone(row.before);
    for (const entry of outfit) {
      const index = drawingSlot(entry.Group);
      const property = entry.Property ? {...entry.Property} as Record<string, unknown> : undefined;
      if (index < 0 || entry.Name !== 'DrawingBoard' || typeof property?.CustomDraw !== 'string' || !property.CustomDraw) continue;
      const key = `${index}:${property.CustomDraw}`;
      if (!shared.has(key)) { shared.set(key, await upload(index, property.CustomDraw)); check(); }
      property.CustomDrawSPS = shared.get(key);
      delete property.CustomDraw;
      entry.Property = property;
    }
    prepared.push({...row, outfit});
  }
  return prepared;
}
