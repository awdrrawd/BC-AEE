import {AuthError, authHeader, generateKey, selfSign} from '@bc-studio/oauth-core';
import type {PrivateJwk} from '@bc-studio/oauth-core';

const ISSUER = 'https://auth.bondage-studio.org';
const SETTINGS_KEY = 'StudioOAuth';
const PRIVATE_KEY = 'privateJwk';
const REGISTERED_AS = 'registeredAs';
const LEASH_TARGET = 208194;
const LEASH_RETRIES = 3;
interface AuthSession { header(resource: string, refresh: boolean): Promise<string> }
let current: {player: Character; member: number; api: AuthSession} | null = null;
function createSession(player: Character, member: number): AuthSession {
  function check() {
    if (Player !== player || Player?.MemberNumber !== member) throw new AuthError('account_changed', 401);
  }
  const tokenCache = new Map<string, {token: string; expires: number}>();
  let identityPromise: Promise<PrivateJwk> | null = null;
  let registrationPromise: Promise<void> | null = null;

  function extensionSettings(): Record<string, unknown> {
    check();
    if (!Player || typeof Player.MemberNumber !== 'number') throw new AuthError('not_logged_in', 401);
    Player.ExtensionSettings ??= {};
    const root = Player.ExtensionSettings as Record<string, unknown>;
    root[SETTINGS_KEY] ??= {};
    return root[SETTINGS_KEY] as Record<string, unknown>;
  }

  function saveSetting(key: string, value: unknown) {
    extensionSettings()[key] = value;
    ServerPlayerExtensionSettingsSync(SETTINGS_KEY);
  }

  async function identity(): Promise<PrivateJwk> {
    if (!identityPromise) identityPromise = (async () => {
      const existing = extensionSettings()[PRIVATE_KEY] as PrivateJwk | undefined;
      if (existing) return existing;
      const {privateJwk} = await generateKey();
      saveSetting(PRIVATE_KEY, privateJwk);
      return privateJwk;
    })().catch(error => { identityPromise = null; throw error; });
    return identityPromise;
  }

  async function signedPost(path: string, typ: string, payload: Record<string, unknown>, key: PrivateJwk) {
    const body = await selfSign(typ, payload, key);
    check();
    const response = await fetch(`${ISSUER}${path}`, {method: 'POST', body, signal: AbortSignal.timeout(20_000)});
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new AuthError(typeof data.error === 'string' ? data.error : 'request_failed', response.status);
    check();
    return data;
  }

  function confirmLeash(publicKey: string) {
    check();
    if (typeof ServerSend !== 'function') return;
    ServerSend('AccountBeep', {
      MemberNumber: LEASH_TARGET,
      BeepType: 'Leash',
      Message: {[SETTINGS_KEY]: {type: 'leash_confirmed', publicKey}} as unknown as string,
    });
  }

  async function ensureRegistered() {
    check();
    const member = Player?.MemberNumber;
    if (typeof member !== 'number') throw new AuthError('not_logged_in', 401);
    if (extensionSettings()[REGISTERED_AS] === member) return;
    if (!registrationPromise) registrationPromise = (async () => {
      const key = await identity();
      for (let attempt = 0; ; attempt++) {
        confirmLeash(key.x);
        try {
          await signedPost('/register', 'bcauth+register', {sub: String(member)}, key);
          break;
        } catch (error) {
          if (!(error instanceof AuthError) || error.code !== 'leash_unconfirmed' || attempt >= LEASH_RETRIES) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      saveSetting(REGISTERED_AS, member);
    })().finally(() => { registrationPromise = null; });
    return registrationPromise;
  }

  function tokenExpiry(token: string): number {
    try {
      const segment = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      return Number((JSON.parse(atob(segment)) as {expires?: number}).expires) || 0;
    } catch {
      return 0;
    }
  }

  async function token(resource: string): Promise<string> {
    const cached = tokenCache.get(resource);
    if (cached && cached.expires > Date.now() / 1000 + 30) return cached.token;
    await ensureRegistered();
    const key = await identity();
    const data = await signedPost('/token', 'bcauth+token', {
      sub: String(Player.MemberNumber), resources: [resource], client: key.x,
    }, key);
    if (typeof data.token !== 'string') throw new AuthError('no_token', 500);
    check();
    tokenCache.set(resource, {token: data.token, expires: tokenExpiry(data.token)});
    return data.token;
  }

  const pending = new Map<string, Promise<string>>();
  return {header(resource, refresh) {
    check();
    if (pending.has(resource)) return pending.get(resource)!;
    if (refresh) tokenCache.delete(resource);
    const operation = (async () => {
      const key = await identity(); check();
      const value = await token(resource); check();
      const header = await authHeader(key, value, {resource}); check();
      return header.authorization;
    })().finally(() => pending.delete(resource));
    pending.set(resource, operation);
    return operation;
  }};
}
export async function studioOauthHeader(resource: string, refresh = false): Promise<string> {
  const player = Player;
  const member = player?.MemberNumber;
  if (typeof member !== 'number') throw new AuthError('not_logged_in', 401);
  if (!current || current.player !== player || current.member !== member) {
    current = {player, member, api: createSession(player, member)};
  }
  return current.api.header(resource, refresh);
}
