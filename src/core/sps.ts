import {studioOauthHeader} from '@/core/studioOauth';

export const SPS_ORIGIN = 'https://storage.bondage-studio.org';
export const SPS_WARDROBE_PREFIX = 'liko-aee:wardon/';
export const SPS_KEY_BUDGET = 10 * 1024 * 1024;

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
  signal.throwIfAborted();
  const response = await fetch(url, {...init, signal});
  // Consume the body while the timeout signal is still attached to the request.
  const body = await response.arrayBuffer();
  return new Response([204, 205, 304].includes(response.status) ? null : body,
    {status: response.status, statusText: response.statusText, headers: response.headers});
}
async function authenticated(url: string, init: RequestInit = {}): Promise<Response> {
  const player = Player;
  const member = player?.MemberNumber;
  const check = () => {
    if (typeof member !== 'number' || Player !== player || Player.MemberNumber !== member) throw new Error('sps_account_changed');
    init.signal?.throwIfAborted();
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    check();
    const headers = new Headers(init.headers);
    headers.set('authorization', await studioOauthHeader(SPS_ORIGIN, attempt > 0));
    check();
    const response = await timedFetch(url, {...init, headers});
    check();
    if (response.status !== 401 || attempt === 1) return response;
  }
  throw new Error('sps_unauthorized');
}
export async function spsRequest(key: string, init: RequestInit = {}): Promise<Response> {
  return authenticated(`${SPS_ORIGIN}/player/data/${key}`, init);
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
  const player = Player;
  const member = player?.MemberNumber;
  const keys = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    if (Player !== player || Player?.MemberNumber !== member) throw new Error('sps_account_changed');
    const query = cursor === null ? '' : `?cursor=${encodeURIComponent(cursor)}`;
    const response = await authenticated(`${SPS_ORIGIN}/player/data${query}`);
    if (!response.ok) throw new Error(`SPS ${response.status}`);
    const data = await response.json() as {ok?: boolean; keys?: unknown; cursor?: unknown};
    if (Player !== player || Player?.MemberNumber !== member) throw new Error('sps_account_changed');
    if (!data || data.ok === false || !Array.isArray(data.keys)
      || !data.keys.every(key => typeof key === 'string')) throw new Error('sps_invalid_key_page');
    for (const key of data.keys) keys.add(key);
    if (data.cursor === null) return [...keys];
    if (typeof data.cursor !== 'string' || !data.cursor || cursors.has(data.cursor)) throw new Error('sps_invalid_cursor');
    cursor = data.cursor;
    cursors.add(cursor);
  }
  throw new Error('sps_page_limit');
}

export async function readSpsPublic(owner: number, key: string, revision?: string): Promise<ArrayBuffer | null> {
  const suffix = revision ? `?v=${encodeURIComponent(revision)}` : '';
  const response = await timedFetch(`${SPS_ORIGIN}/public/data/${owner}/${key}${suffix}`, {cache: 'no-store'});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`SPS ${response.status}`);
  return response.arrayBuffer();
}

export async function writeSpsPublic(key: string, data: Blob | ArrayBuffer): Promise<void> {
  const size = data instanceof Blob ? data.size : data.byteLength;
  if (size > SPS_KEY_BUDGET) throw new Error('value_too_large');
  const response = await authenticated(`${SPS_ORIGIN}/public/data/${key}`, {method: 'PUT', body: data});
  if (!response.ok) throw new Error(`SPS ${response.status}`);
}
