import {bundleAppearance} from '@/util/appearanceBundle';
import {PROP_KEY, PROP_SPS_KEY} from '../constants';
import type {AnyProps} from './types';
import {A, findSlotItem} from './slots';
import {safeCurrentCharacter} from './currentCharacter';

export const APPEARANCE_WARN_BYTES = 140_000;
export const APPEARANCE_UPLOAD_BYTES = 160_000;
export const APPEARANCE_HARD_BYTES = 180_000;

export function canvasEmbeddedData(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/png');
  return typeof LZString !== 'undefined' ? LZString.compressToBase64(dataUrl) : dataUrl;
}

function projectedAppearance(C: Character, compressed: string): readonly Item[] {
  if (!A) return C.Appearance;
  const item = findSlotItem(C, A) || (typeof InventoryGet === 'function' ? InventoryGet(C, A.group) : null);
  if (!item) return C.Appearance;
  const property: AnyProps = {...(item.Property as AnyProps | undefined), [PROP_KEY]: compressed};
  delete property[PROP_SPS_KEY];
  return C.Appearance.map(value => value === item ? {...value, Property: property} : value);
}

export function projectedAppearanceBytes(compressed: string): number {
  const C = safeCurrentCharacter();
  if (!C) return 0;
  try {
    const appearance = bundleAppearance(projectedAppearance(C, compressed));
    return new TextEncoder().encode(JSON.stringify(['AccountUpdate', {
      Appearance: appearance,
      AssetFamily: C.AssetFamily || 'Female3DCG',
    }])).byteLength;
  } catch {
    return 0;
  }
}

export function formatBytesK(bytes: number): string {
  const k = bytes / 1000;
  return `${k < 10 ? k.toFixed(1) : Math.round(k)}K`;
}
