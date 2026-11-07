// Support for layers that BC draws from a canvas instead of a PNG url.
//
// Text layers (sign / label / tag items) are painted in the asset's
// `AfterDraw` hook: the text is rendered onto a temporary canvas and handed to
// `drawCanvas(canvas, X, Y, masks)`. BC's CommonDraw only passes
// TranslationX/Y, ScaleX/Y and Rotation to `drawImage(url, ...)`, so such
// layers silently ignore every native layer transform, and AEE never saw them
// because its capture only accepted string urls. This module closes both gaps.

export const CANVAS_URL_PREFIX = 'aee-canvas:';

export interface NativeLayerTransform {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  rot: number;
}

const snapshots = new Map<string, HTMLCanvasElement>();

export function isCanvasSource(source: unknown): source is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement;
}

export function canvasSnapshotKey(layerIndex: number, blink: boolean): string {
  return `${CANVAS_URL_PREFIX}${layerIndex}:${blink ? 'b' : 'n'}`;
}

/** BC reuses/discards its temp canvas, so keep a private copy of the pixels. */
export function setCanvasSnapshot(key: string, source: HTMLCanvasElement): void {
  let copy = snapshots.get(key);
  if (!copy) {
    copy = document.createElement('canvas');
    snapshots.set(key, copy);
  }
  if (copy.width !== source.width) copy.width = source.width;
  if (copy.height !== source.height) copy.height = source.height;
  const context = copy.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, copy.width, copy.height);
  context.drawImage(source, 0, 0);
}

export function getCanvasSnapshot(url: string): HTMLCanvasElement | null {
  return snapshots.get(url) ?? null;
}

/**
 * Mirror of CommonDraw's `getTransform` (Translation/Rotation add, Scale
 * multiplies, same clamps). Returns null when the layer has no transform so
 * untouched items are never modified.
 */
export function resolveNativeLayerTransform(item: Item, layerName: string): NativeLayerTransform | null {
  const props = (item.Property ?? {}) as Record<string, unknown>;
  const read = (name: string): {layer?: number; asset?: number} => {
    const layerMap = props[`Layer${name}`] as Record<string, unknown> | undefined;
    const valid = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
    return {layer: valid(layerMap?.[layerName]), asset: valid(props[name])};
  };
  const add = (name: string) => {
    const {layer, asset} = read(name);
    return (layer ?? 0) + (asset ?? 0);
  };
  const scale = (name: string) => {
    const {layer, asset} = read(name);
    let value = asset ?? 1;
    if (layer !== undefined) value *= layer;
    return Math.max(0.01, Math.min(3, value));
  };
  const transform: NativeLayerTransform = {
    tx: add('TranslationX'),
    ty: add('TranslationY'),
    sx: scale('ScaleX'),
    sy: scale('ScaleY'),
    rot: Math.max(-180, Math.min(180, add('Rotation'))),
  };
  const identity = transform.tx === 0 && transform.ty === 0 && transform.sx === 1 && transform.sy === 1 && transform.rot === 0;
  return identity ? null : transform;
}
