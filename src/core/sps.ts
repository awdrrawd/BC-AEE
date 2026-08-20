import {studioOauthHeader} from '@/core/studioOauth';

export const SPS_ORIGIN = 'https://storage.bondage-studio.org';
export const SPS_WARDROBE_PREFIX = 'liko-aee:wardon/';
export const SPS_KEY_BUDGET = 10 * 1024 * 1024;

async function authorization(): Promise<string> {
  return studioOauthHeader(SPS_ORIGIN);
}

export async function spsRequest(key: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', await authorization());
  return fetch(`${SPS_ORIGIN}/player/data/${key}`, {...init, headers});
}

export async function readSpsText(key: string): Promise<string | null> {
  const response = await spsRequest(key);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`SPS ${response.status}`);
  const text = await response.text();
  return text;
}

export async function writeSpsText(key: string, text: string): Promise<void> {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > SPS_KEY_BUDGET) throw new Error('value_too_large');
  const response = await spsRequest(key, {method: 'PUT', body: text});
  if (!response.ok) throw new Error(`SPS ${response.status}`);
}

export async function listSpsKeys(): Promise<string[]> {
  const response = await spsRequest('');
  if (!response.ok) throw new Error(`SPS ${response.status}`);
  const data = await response.json() as {keys?: unknown};
  return Array.isArray(data.keys) ? data.keys.filter((key): key is string => typeof key === 'string') : [];
}

export async function readSpsPublic(owner: number, key: string, revision?: string): Promise<ArrayBuffer | null> {
  const suffix = revision ? `?v=${encodeURIComponent(revision)}` : '';
  const response = await fetch(`${SPS_ORIGIN}/public/data/${owner}/${key}${suffix}`, {cache: 'no-store'});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`SPS ${response.status}`);
  return response.arrayBuffer();
}

export async function writeSpsPublic(key: string, data: Blob | ArrayBuffer): Promise<void> {
  const size = data instanceof Blob ? data.size : data.byteLength;
  if (size > SPS_KEY_BUDGET) throw new Error('value_too_large');
  const headers = new Headers({authorization: await authorization()});
  const response = await fetch(`${SPS_ORIGIN}/public/data/${key}`, {method: 'PUT', headers, body: data});
  if (!response.ok) throw new Error(`SPS ${response.status}`);
}
