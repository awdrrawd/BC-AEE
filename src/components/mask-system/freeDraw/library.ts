import {readSpsPublic, writeSpsPublic} from '@/core/sps';

const PREFIX = 'liko-aee:FreeDrawData/';
const MAGIC = new TextEncoder().encode('AEELB1');
const GROUPS = 6;
const PER_GROUP = 5;
const IMAGE_LIMIT = 2_000_000;
const GROUP_LIMIT = 10_400_000;

export interface LibraryEntry {
  name: string;
  mime: string;
  hash: string;
  data: Uint8Array;
}

const empty = (): LibraryEntry => ({name: '', mime: '', hash: '', data: new Uint8Array()});
const groups = new Map<number, LibraryEntry[]>();
const pending = new Map<number, Promise<LibraryEntry[]>>();
let cachedOwner: number | null = null;

function currentOwner(): number {
  const owner = Player?.MemberNumber;
  if (typeof owner !== 'number') throw new Error('not_logged_in');
  if (cachedOwner !== owner) {
    cachedOwner = owner;
    groups.clear();
    pending.clear();
  }
  return owner;
}

const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');

function decode(buffer: ArrayBuffer | null): LibraryEntry[] {
  if (!buffer) return Array.from({length: PER_GROUP}, empty);
  const bytes = new Uint8Array(buffer);
  if (bytes.length < MAGIC.length || !MAGIC.every((value, index) => bytes[index] === value)) throw new Error('bad_library_container');
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const result: LibraryEntry[] = [];
  let offset = MAGIC.length;
  for (let i = 0; i < PER_GROUP; i++) {
    if (offset + 2 > bytes.length) throw new Error('bad_library_container');
    const nameLength = view.getUint16(offset, true); offset += 2;
    if (offset + nameLength + 1 + 32 + 4 > bytes.length) throw new Error('bad_library_container');
    const name = decoder.decode(bytes.slice(offset, offset + nameLength)); offset += nameLength;
    const mimeCode = bytes[offset++];
    const hashBytes = bytes.slice(offset, offset + 32); offset += 32;
    const length = view.getUint32(offset, true); offset += 4;
    if (length > IMAGE_LIMIT || offset + length > bytes.length) throw new Error('bad_library_container');
    result.push({name, mime: mimeCode === 2 ? 'image/webp' : mimeCode === 1 ? 'image/png' : '',
      hash: length ? hex(hashBytes) : '', data: bytes.slice(offset, offset + length)});
    offset += length;
  }
  return result;
}

function encode(entries: LibraryEntry[]): ArrayBuffer {
  const encoder = new TextEncoder();
  const names = entries.map(entry => encoder.encode(entry.name.slice(0, 60)));
  const size = MAGIC.length + entries.reduce((sum, entry, index) => sum + 2 + names[index].length + 1 + 32 + 4 + entry.data.length, 0);
  if (size > GROUP_LIMIT) throw new Error('freedraw_library_group_too_large');
  const output = new Uint8Array(size);
  const view = new DataView(output.buffer);
  output.set(MAGIC);
  let offset = MAGIC.length;
  entries.forEach((entry, index) => {
    view.setUint16(offset, names[index].length, true); offset += 2;
    output.set(names[index], offset); offset += names[index].length;
    output[offset++] = entry.mime === 'image/webp' ? 2 : entry.data.length ? 1 : 0;
    const hash = entry.hash ? Uint8Array.from(entry.hash.match(/.{2}/g)?.map(value => parseInt(value, 16)) ?? []) : new Uint8Array();
    output.set(hash.slice(0, 32), offset); offset += 32;
    view.setUint32(offset, entry.data.length, true); offset += 4;
    output.set(entry.data, offset); offset += entry.data.length;
  });
  return output.buffer;
}

async function loadGroup(group: number): Promise<LibraryEntry[]> {
  if (group < 0 || group >= GROUPS) throw new Error('bad_library_group');
  const hit = groups.get(group);
  if (hit) return hit;
  const active = pending.get(group);
  if (active) return active;
  const owner = currentOwner();
  const work = readSpsPublic(owner, `${PREFIX}${group + 1}`).then(decode).then(entries => {
    groups.set(group, entries);
    return entries;
  }).finally(() => pending.delete(group));
  pending.set(group, work);
  return work;
}

export function peekLibraryPage(page: number): LibraryEntry[] | null {
  try { currentOwner(); } catch { return null; }
  return groups.get(page) ?? null;
}

export function ensureLibraryPage(page: number): Promise<LibraryEntry[]> {
  return loadGroup(page);
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('canvas_encode_failed')), 'image/png'));
}

export async function saveLibrarySlot(index: number, name: string, canvas: HTMLCanvasElement): Promise<void> {
  const group = Math.floor(index / PER_GROUP);
  const local = index % PER_GROUP;
  const entries = [...await loadGroup(group)];
  const blob = await canvasBlob(canvas);
  if (blob.size > IMAGE_LIMIT) throw new Error('freedraw_library_image_too_large');
  const data = new Uint8Array(await blob.arrayBuffer());
  const hash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
  entries[local] = {name: name.trim().slice(0, 60), mime: blob.type || 'image/png', hash, data};
  await writeSpsPublic(`${PREFIX}${group + 1}`, encode(entries));
  groups.set(group, entries);
}

export async function clearLibrarySlot(index: number): Promise<void> {
  const group = Math.floor(index / PER_GROUP);
  const local = index % PER_GROUP;
  const entries = [...await loadGroup(group)];
  entries[local] = empty();
  await writeSpsPublic(`${PREFIX}${group + 1}`, encode(entries));
  groups.set(group, entries);
}

export async function recallLibrarySlot(index: number): Promise<Blob | null> {
  const entries = await loadGroup(Math.floor(index / PER_GROUP));
  const entry = entries[index % PER_GROUP];
  return entry?.data.length ? new Blob([entry.data], {type: entry.mime || 'image/png'}) : null;
}
