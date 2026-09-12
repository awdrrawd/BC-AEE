import {readSpsPublic, SPS_ORIGIN, writeSpsPublic} from '@/core/sps';
import type {AnyProps} from './types';
import {PROP_SPS_KEY} from '../constants';

const LEGACY_KEY = 'liko-aee:freedraw/1';
const activeKey = (slot: number) => `liko-aee:FreeDraw/${slot + 1}`;
const transferKey = (slot: number) => `liko-aee:FreeDrawTransfer/${slot + 1}`;
const contentKey = (hash: string) => `liko-aee:FreeDrawBlob/${hash}`;
const MAGIC = new TextEncoder().encode('AEEFD1');
const SLOT_LIMIT = 3_300_000;
const HEADER_SIZE = MAGIC.length + 3 * (1 + 32 + 4);

export interface SpsDrawRef {o: number; s: number; r: string; m: string; u: string; v?: 2 | 3 | 4}
interface Entry {mime: string; hash: Uint8Array; data: Uint8Array}

const empty = (): Entry => ({mime: '', hash: new Uint8Array(32), data: new Uint8Array()});
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
const MAX_CACHE_ENTRIES = 96;
function remember(id: string, source: string) {
  cache.delete(id); cache.set(id, source);
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
}
function imageSource(blob: Blob): Promise<string> {
  // Data URLs remain valid in downstream image caches after our LRU evicts them.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('image_encode_failed'));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function readDrawRef(props: AnyProps | undefined): SpsDrawRef | null {
  const ref = props?.[PROP_SPS_KEY] as Partial<SpsDrawRef> | undefined;
  return ref && Number.isInteger(ref.o) && Number(ref.o) >= 0 && Number.isInteger(ref.s) && ref.s >= 0 && ref.s < 3 &&
    typeof ref.r === 'string' && /^[a-f0-9]{64}$/.test(ref.r) && typeof ref.u === 'string'
    ? {o: ref.o, s: ref.s, r: ref.r, m: typeof ref.m === 'string' ? ref.m : 'image/png', u: ref.u,
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
  if (hit) { remember(id, hit); return hit; }
  if (!pending.has(id)) {
    const work = downloadSpsDrawing(ref).then(async blob => {
      if (!blob) return null;
      const url = await imageSource(blob);
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
    const buffer = await readSpsPublic(ref.o, ref.v === 4 ? contentKey(ref.r) : ref.v === 3 ? transferKey(ref.s) : activeKey(ref.s), ref.r);
    if (!buffer) return null;
    const data = new Uint8Array(buffer);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    return hex(hash) === ref.r ? new Blob([data], {type: ref.m}) : null;
  }
  const entry = decode(await readSpsPublic(ref.o, LEGACY_KEY, ref.r))[ref.s];
  return entry.data.length && hex(entry.hash) === ref.r
    ? new Blob([entry.data], {type: entry.mime || ref.m}) : null;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas_encode_failed')), 'image/png'));
}

export async function uploadSpsBlob(slot: number, blob: Blob): Promise<SpsDrawRef> {
  const player = Player;
  const owner = player?.MemberNumber;
  const check = () => { if (typeof owner !== 'number' || Player !== player || Player.MemberNumber !== owner) throw new Error('sps_account_changed'); };
  check();
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3) throw new Error('invalid_freedraw_slot');
  if (blob.size > SLOT_LIMIT) throw new Error('freedraw_image_too_large');
  const data = new Uint8Array(await blob.arrayBuffer());
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const revision = hex(hash);
  const key = contentKey(revision);
  check();
  await writeSpsPublic(key, blob);
  check();
  const url = `${SPS_ORIGIN}/public/data/${owner}/${key}`;
  const objectUrl = await imageSource(blob);
  check();
  remember(`${owner}:${slot}:${revision}`, objectUrl);
  return {o: owner!, s: slot, r: revision, m: blob.type || 'image/png', u: url, v: 4};
}

export async function uploadSpsDrawing(slot: number, canvas: HTMLCanvasElement): Promise<SpsDrawRef> {
  const player = Player;
  const owner = player?.MemberNumber;
  const blob = await canvasBlob(canvas);
  if (Player !== player || Player.MemberNumber !== owner) throw new Error('sps_account_changed');
  return uploadSpsBlob(slot, blob);
}
