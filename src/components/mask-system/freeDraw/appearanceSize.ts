import {bundleAppearance} from '@/util/appearanceBundle';
import {PROP_KEY, PROP_SPS_KEY} from '../constants';
import type {AnyProps, SlotEditSession} from './types';

export const APPEARANCE_WARN_BYTES = 140_000;
export const APPEARANCE_UPLOAD_BYTES = 160_000;
export const APPEARANCE_HARD_BYTES = 180_000;

export function canvasEmbeddedData(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/png');
  return typeof LZString !== 'undefined' ? LZString.compressToBase64(dataUrl) : dataUrl;
}

function projectedAppearance(session: SlotEditSession, compressed: string): readonly Item[] {
  const {character: C, item} = session;
  if (!C.Appearance.includes(item)) throw new Error('free_draw_item_not_in_appearance');
  const property: AnyProps = {...(item.Property as AnyProps | undefined)};
  if (compressed) property[PROP_KEY] = compressed;
  else delete property[PROP_KEY];
  delete property[PROP_SPS_KEY];
  return C.Appearance.map(value => value === item ? {...value, Property: property} : value);
}

// Deliberately throws on projection/serialization failures. Callers must block
// embedded saving or display a conservative warning; returning zero here would
// turn every estimator failure into permission to exceed the server limit.
export function projectedAppearanceBytes(compressed: string, session: SlotEditSession): number {
  const C = session.character;
  const appearance = bundleAppearance(projectedAppearance(session, compressed));
  return new TextEncoder().encode(JSON.stringify(['AccountUpdate', {
    Appearance: appearance,
    AssetFamily: C.AssetFamily || 'Female3DCG',
  }])).byteLength;
}

export function formatBytesK(bytes: number): string {
  const k = bytes / 1000;
  return `${k < 10 ? k.toFixed(1) : Math.round(k)}K`;
}
