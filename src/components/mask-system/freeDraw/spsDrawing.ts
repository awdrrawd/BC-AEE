import {readSpsPublic, SPS_ORIGIN, writeSpsPublic} from '@/core/sps';
import type {AnyProps} from './types';
import {PROP_SPS_KEY} from '../constants';

const LEGACY_KEY = 'liko-aee:freedraw/1';
const activeKey = (slot: number) => `liko-aee:FreeDraw/${slot + 1}`;
const transferKey = (slot: number) => `liko-aee:FreeDrawTransfer/${slot + 1}`;
const contentKey = (revision: string) => `liko-aee:FreeDrawBlob/${revision}`;
const MAGIC = new TextEncoder().encode('AEEFD1');
const SLOT_LIMIT = 3_300_000;
const HEADER_SIZE = MAGIC.length + 3 * (1 + 32 + 4);

export interface SpsDrawRef {o: number; s: number; r: string; m: string; u: string; v?: 2 | 3 | 4}
interface Entry {mime: string; hash: Uint8Array; data: Uint8Array}

const empty = (): Entry => ({mime: '', hash: new Uint8Array(32), data: new Uint8Array()});
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
const MAX_CACHE_ENTRIES = 96;

function remember(id: string, url: string) {
  const previous = cache.get(id);
  if (previous && previous !== url) URL.revokeObjectURL(previous);
  cache.delete(id);
  cache.set(id, url);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.entries().next().value as [string, string] | undefined;
    if (!oldest) break;
    cache.delete(oldest[0]);
    URL.revokeObjectURL(oldest[1]);
  }
}

export function readDrawRef(props: AnyProps | undefined): SpsDrawRef | null {
  const ref = props?.[PROP_SPS_KEY] as Partial<SpsDrawRef> | undefined;
  return ref && Number.isInteger(ref.o) && Number(ref.o) >= 0
    && Number.isInteger(ref.s) && Number(ref.s) >= 0 && Number(ref.s) < 3
    && typeof ref.r === 'string' && /^[a-f0-9]{64}$/i.test(ref.r) && typeof ref.u === 'string'
    ? {o: ref.o, s: ref.s, r: ref.r.toLowerCase(), m: ref.m === 'image/webp' ? 'image/webp' : 'image/png', u: ref.u,
      ...(ref.v === 2 || ref.v === 3 || ref.v === 4 ? {v: ref.v} : {})} : null;
}

function decode(buffer: ArrayBuffer | null): Entry[] {
  if (!buffer) return [empty(), empty(), empty()];
  const bytes = new Uint8Array(buffer);
  if (bytes.length < HEADER_SIZE || !MAGIC.every((value, index) => bytes[index] === value)) throw new Error('bad_freedraw_container');
  const view = new DataView(buffer);
  const entries: Entry[] = [];
  let header = MAGIC.length;
  let dataOffset = HEADER_SIZE;
  for (let slot = 0; slot < 3; slot++) {
    const mimeCode = bytes[header++];
    const hash = bytes.slice(header, header + 32); header += 32;
    const length = view.getUint32(header, true); header += 4;
    if (length > SLOT_LIMIT || dataOffset + length > bytes.length) throw new Error('bad_freedraw_container');
    entries.push({mime: mimeCode === 2 ? 'image/webp' : mimeCode === 1 ? 'image/png' : '', hash, data: bytes.slice(dataOffset, dataOffset + length)});
    dataOffset += length;
  }
  return entries;
}

const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');

function refreshCharacters() {
  try {
    const characters: Character[] = [Player, ...(ChatRoomCharacter ?? [])];
    for (const character of characters) CharacterLoadCanvas(character);
  } catch { /* screen may have changed while downloading */ }
}

export function cachedSpsDrawUrl(props: AnyProps | undefined): string | null {
  const ref = readDrawRef(props);
  if (!ref) return null;
  const id = `${ref.o}:${ref.s}:${ref.r}`;
  const hit = cache.get(id);
  if (hit) return hit;
  if (!pending.has(id)) {
    const work = downloadSpsDrawing(ref).then(blob => {
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      remember(id, url);
      refreshCharacters();
      return url;
    }).catch(error => { console.warn('🐈‍⬛ [AEE] Failed to download SPS drawing', error); return null; })
      .finally(() => pending.delete(id));
    pending.set(id, work);
  }
  return null;
}

export async function resolveSpsDrawUrl(props: AnyProps | undefined): Promise<string | null> {
  const ref = readDrawRef(props);
  if (!ref) return null;
  cachedSpsDrawUrl(props);
  return pending.get(`${ref.o}:${ref.s}:${ref.r}`) ?? cache.get(`${ref.o}:${ref.s}:${ref.r}`) ?? null;
}

export async function downloadSpsDrawing(ref: SpsDrawRef): Promise<Blob | null> {
  if (ref.v === 2 || ref.v === 3 || ref.v === 4) {
    const key = ref.v === 4 ? contentKey(ref.r) : ref.v === 3 ? transferKey(ref.s) : activeKey(ref.s);
    const buffer = await readSpsPublic(ref.o, key);
    if (!buffer) return null;
    const data = new Uint8Array(buffer);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return hex(hash) === ref.r ? new Blob([data], {type: ref.m}) : null;
  }
  const entry = decode(await readSpsPublic(ref.o, LEGACY_KEY))[ref.s];
  return entry.data.length && hex(entry.hash) === ref.r
    ? new Blob([entry.data], {type: entry.mime || ref.m}) : null;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas_encode_failed')), 'image/png'));
}

export async function uploadSpsBlob(slot: number, blob: Blob): Promise<SpsDrawRef> {
  if (typeof Player?.MemberNumber !== 'number') throw new Error('not_logged_in');
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3) throw new Error('invalid_freedraw_slot');
  if (blob.size > SLOT_LIMIT) throw new Error('freedraw_image_too_large');
  const data = new Uint8Array(await blob.arrayBuffer());
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const revision = hex(hash);
  // Content-addressed keys are immutable from AEE's point of view. Re-uploading the
  // same bytes is harmless, while a later drawing can no longer invalidate old outfits.
  const key = contentKey(revision);
  await writeSpsPublic(key, blob);
  const url = `${SPS_ORIGIN}/public/data/${Player.MemberNumber}/${key}`;
  const objectUrl = URL.createObjectURL(blob);
  remember(`${Player.MemberNumber}:${slot}:${revision}`, objectUrl);
  return {o: Player.MemberNumber, s: slot, r: revision, m: blob.type || 'image/png', u: url, v: 4};
}

export async function uploadSpsDrawing(slot: number, canvas: HTMLCanvasElement): Promise<SpsDrawRef> {
  return uploadSpsBlob(slot, await canvasBlob(canvas));
}
