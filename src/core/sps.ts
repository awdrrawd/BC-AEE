export const SPS_ORIGIN = 'https://storage.bondage-studio.org';
export const SPS_WARDROBE_PREFIX = 'liko-aee:wardon/';
export const SPS_KEY_BUDGET = 10 * 1024 * 1024;
const SPS_REQUEST_TIMEOUT_MS = 20_000;

export class SpsError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
    this.name = 'SpsError';
  }
}

function oauthClient(): StudioOauthApi {
  return (globalThis as typeof globalThis & {studioOauth: StudioOauthApi}).studioOauth;
}

async function authorization(forceRefresh = false): Promise<string> {
  if (forceRefresh) await oauthClient().login(null, [SPS_ORIGIN]);
  return oauthClient().header(SPS_ORIGIN);
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(new DOMException('SPS request timed out', 'TimeoutError')),
    SPS_REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', abort, {once: true});
  try {
    return await fetch(url, {...init, signal: controller.signal});
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}

async function errorFor(response: Response): Promise<SpsError> {
  const data = await response.clone().json().catch(() => null) as {error?: {code?: unknown}} | null;
  const code = typeof data?.error?.code === 'string' ? data.error.code : `http_${response.status}`;
  return new SpsError(response.status, code);
}

export async function spsRequest(key: string, init: RequestInit = {}, query = ''): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', await authorization());
  const url = `${SPS_ORIGIN}/player/data/${key}${query}`;
  let response = await timedFetch(url, {...init, headers});
  if (response.status === 401) {
    headers.set('authorization', await authorization(true));
    response = await timedFetch(url, {...init, headers});
  }
  return response;
}

export async function readSpsText(key: string): Promise<string | null> {
  const response = await spsRequest(key);
  if (response.status === 404) return null;
  if (!response.ok) throw await errorFor(response);
  const text = await response.text();
  return text;
}

export async function writeSpsText(key: string, text: string): Promise<void> {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > SPS_KEY_BUDGET) throw new Error('value_too_large');
  const response = await spsRequest(key, {method: 'PUT', body: text});
  if (!response.ok) throw await errorFor(response);
}

export async function listSpsKeys(): Promise<string[]> {
  const keys: string[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const response = await spsRequest('', {}, query);
    if (!response.ok) throw await errorFor(response);
    const data = await response.json() as {keys?: unknown; cursor?: unknown};
    if (Array.isArray(data.keys)) keys.push(...data.keys.filter((key): key is string => typeof key === 'string'));
    cursor = typeof data.cursor === 'string' && data.cursor ? data.cursor : null;
    if (cursor) {
      if (seenCursors.has(cursor)) throw new SpsError(500, 'pagination_loop');
      seenCursors.add(cursor);
    }
  } while (cursor);
  return keys;
}

export async function deleteSpsKey(key: string): Promise<void> {
  const response = await spsRequest(key, {method: 'DELETE'});
  // Transaction replay is intentionally idempotent: a prior attempt may have
  // deleted the value and crashed before removing its journal.
  if (response.status === 404) return;
  if (!response.ok) throw await errorFor(response);
}

export async function readSpsPublic(owner: number, key: string): Promise<ArrayBuffer | null> {
  const response = await timedFetch(`${SPS_ORIGIN}/public/data/${owner}/${key}`, {cache: 'no-store'});
  if (response.status === 404) return null;
  if (!response.ok) throw await errorFor(response);
  return response.arrayBuffer();
}

export async function writeSpsPublic(key: string, data: Blob | ArrayBuffer): Promise<void> {
  const size = data instanceof Blob ? data.size : data.byteLength;
  if (size > SPS_KEY_BUDGET) throw new Error('value_too_large');
  const headers = new Headers({authorization: await authorization()});
  const url = `${SPS_ORIGIN}/public/data/${key}`;
  let response = await timedFetch(url, {method: 'PUT', headers, body: data});
  if (response.status === 401) {
    headers.set('authorization', await authorization(true));
    response = await timedFetch(url, {method: 'PUT', headers, body: data});
  }
  if (!response.ok) throw await errorFor(response);
}
