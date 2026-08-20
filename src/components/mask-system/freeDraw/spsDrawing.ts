import {readSpsPublic, SPS_ORIGIN, writeSpsPublic} from '@/core/sps';
import type {AnyProps} from './types';
import {PROP_SPS_KEY} from '../constants';

const KEY = 'liko-aee:freedraw/1';
const MAGIC = new TextEncoder().encode('AEEFD1');
const SLOT_LIMIT = 3_300_000;
const TOTAL_LIMIT = 9_900_000;
const HEADER_SIZE = MAGIC.length + 3 * (1 + 32 + 4);

export interface SpsDrawRef {o: number; s: number; r: string; m: string; u: string}
interface Entry {mime: string; hash: Uint8Array; data: Uint8Array}

const empty = (): Entry => ({mime: '', hash: new Uint8Array(32), data: new Uint8Array()});
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function readDrawRef(props: AnyProps | undefined): SpsDrawRef | null {
  const ref = props?.[PROP_SPS_KEY] as Partial<SpsDrawRef> | undefined;
  return ref && typeof ref.o === 'number' && Number.isInteger(ref.s) && ref.s >= 0 && ref.s < 3 &&
    typeof ref.r === 'string' && typeof ref.u === 'string'
    ? {o: ref.o, s: ref.s, r: ref.r, m: typeof ref.m === 'string' ? ref.m : 'image/png', u: ref.u} : null;
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

function encode(entries: Entry[]): ArrayBuffer {
  const total = entries.reduce((sum, entry) => sum + entry.data.byteLength, 0);
  if (total > TOTAL_LIMIT) throw new Error('freedraw_total_too_large');
  const output = new Uint8Array(HEADER_SIZE + total);
  output.set(MAGIC);
  const view = new DataView(output.buffer);
  let header = MAGIC.length;
  let dataOffset = HEADER_SIZE;
  for (const entry of entries) {
    output[header++] = entry.mime === 'image/webp' ? 2 : entry.data.length ? 1 : 0;
    output.set(entry.hash, header); header += 32;
    view.setUint32(header, entry.data.byteLength, true); header += 4;
    output.set(entry.data, dataOffset); dataOffset += entry.data.byteLength;
  }
  return output.buffer;
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
    const work = readSpsPublic(ref.o, KEY, ref.r).then(buffer => {
      const entry = decode(buffer)[ref.s];
      if (!entry.data.length || hex(entry.hash) !== ref.r) return null;
      const url = URL.createObjectURL(new Blob([entry.data], {type: entry.mime || ref.m}));
      cache.set(id, url);
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

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas_encode_failed')), 'image/png'));
}

export async function uploadSpsDrawing(slot: number, canvas: HTMLCanvasElement): Promise<SpsDrawRef> {
  if (typeof Player?.MemberNumber !== 'number') throw new Error('not_logged_in');
  const blob = await canvasBlob(canvas);
  if (blob.size > SLOT_LIMIT) throw new Error('freedraw_image_too_large');
  const data = new Uint8Array(await blob.arrayBuffer());
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const current = decode(await readSpsPublic(Player.MemberNumber, KEY));
  current[slot] = {mime: blob.type || 'image/png', hash, data};
  await writeSpsPublic(KEY, encode(current));
  const revision = hex(hash);
  const url = `${SPS_ORIGIN}/public/data/${Player.MemberNumber}/${KEY}`;
  const objectUrl = URL.createObjectURL(blob);
  cache.set(`${Player.MemberNumber}:${slot}:${revision}`, objectUrl);
  return {o: Player.MemberNumber, s: slot, r: revision, m: blob.type || 'image/png', u: url};
}
