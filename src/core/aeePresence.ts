import bcAeeModSdk from '@/modsdk';
import {MOD_VERSION} from '@/core/version';
import {settings} from '@/core/settings';
import {DEFAULT_FONT_ID} from '@/core/fonts';

export interface AeeSharedSettings {
  Version: string;
  ItemFont?: string;
  FreeDraw: boolean;
}

declare global {
  interface CharacterOnlineSharedSettings { AEE?: AeeSharedSettings; AEEItemFont?: string; }
}

const PREFIX = 'LikoAEE:status:';
const INTERVAL = 30_000;
const TTL = 75_000;
const peers = new Map<number, {expires: number; version: string}>();
let installed = false;
const requests = new Map<string, number>();

function localActive(): boolean {
  return installed && bcModSdk.getModsInfo().some(mod => mod.name === 'Liko - AEE');
}
function inRoom(): boolean {
  return typeof ServerPlayerIsInChatRoom === 'function' && ServerPlayerIsInChatRoom();
}
function roomMember(member: number): boolean {
  return inRoom() && ChatRoomCharacter.some(character => character.MemberNumber === member);
}

/** Shared account data is descriptive only; it never proves a live client. */
export function shareAeeSettings(): void {
  if (!localActive() || typeof Player === 'undefined' || !Player?.MemberNumber) return;
  Player.OnlineSharedSettings ??= {} as CharacterOnlineSharedSettings;
  const shared = Player.OnlineSharedSettings;
  const font = settings.itemFont.get();
  const next: AeeSharedSettings = {Version: MOD_VERSION, FreeDraw: settings.enableFreeDraw.get()};
  if (font && font !== DEFAULT_FONT_ID) next.ItemFont = font;
  if (JSON.stringify(shared.AEE) === JSON.stringify(next) && shared.AEEItemFont == null) return;
  shared.AEE = next;
  delete shared.AEEItemFont;
  ServerAccountUpdate.QueueData({OnlineSharedSettings: shared});
  if (inRoom()) ChatRoomCharacterUpdate(Player);
}

export function getAeeStatus(character: Character | number | null | undefined) {
  const member = typeof character === 'number' ? character : character?.MemberNumber;
  const own = typeof Player !== 'undefined' && (character === Player || member != null && member === Player?.MemberNumber);
  if (own) return {enabled: localActive(), version: MOD_VERSION, freeDraw: localActive() && settings.enableFreeDraw.get()};
  const peer = member != null && roomMember(member) ? peers.get(member) : undefined;
  const enabled = localActive() && !!peer && peer.expires > Date.now();
  // A saved setting is meaningful only after a live AEE response. Use the
  // room's current character, not a possibly stale editor clone.
  const shared = enabled ? ChatRoomCharacter.find(c => c.MemberNumber === member)?.OnlineSharedSettings?.AEE : undefined;
  return {enabled, version: enabled ? peer.version : null, freeDraw: enabled ? shared?.FreeDraw : false};
}

export function isAeeMember(member: number | null | undefined): boolean {
  return getAeeStatus(member).enabled;
}

function send(payload: object, target?: number): void {
  if (!localActive() || !inRoom()) return;
  ServerSend('ChatRoomChat', {Type: 'Hidden', Content: PREFIX + JSON.stringify(payload), Dictionary: [],
    ...(target == null ? {} : {Target: target})});
}

function requestStatus(): void {
  if (!localActive() || !inRoom()) return;
  const now = Date.now();
  for (const [key, expires] of requests) if (expires < now) requests.delete(key);
  const nonce = crypto.randomUUID();
  requests.set(nonce, now + INTERVAL);
  send({type: 'request', nonce});
}

export function installPeerDetection(): boolean {
  if (installed) return true;
  if (typeof ChatRoomMessage !== 'function' || typeof ChatRoomSync !== 'function') return false;
  installed = true;
  Object.assign(window.Liko.AEE, {
    getStatus: getAeeStatus,
    isEnabled: (character: Character | number) => getAeeStatus(character).enabled,
  });
  bcAeeModSdk.hookFunction('ChatRoomMessage', 0, (args, next) => {
    const data = args[0];
    if (localActive() && data?.Type === 'Hidden' && data.Content?.startsWith(PREFIX)
      && data.Sender !== Player.MemberNumber && roomMember(data.Sender)) {
      try {
        const parsed: unknown = JSON.parse(data.Content.slice(PREFIX.length));
        const message = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown> : {};
        if (message.type === 'request' && typeof message.nonce === 'string' && message.nonce.length <= 64) {
          send({type: 'reply', nonce: message.nonce, version: MOD_VERSION, freeDraw: settings.enableFreeDraw.get()}, data.Sender);
        } else if (message.type === 'changed') {
          requestStatus();
        } else if (message.type === 'reply' && typeof message.nonce === 'string'
          && (requests.get(message.nonce) ?? 0) >= Date.now() && typeof message.version === 'string'
          && message.version.length <= 64) {
          peers.set(data.Sender, {expires: Date.now() + TTL, version: message.version});
        }
      } catch { /* Ignore malformed third-party payloads. */ }
    }
    return next(args);
  });
  bcAeeModSdk.hookFunction('ChatRoomSync', 0, async (args, next) => {
    peers.clear();
    requests.clear();
    const result = await next(args);
    shareAeeSettings();
    requestStatus();
    return result;
  });
  bcAeeModSdk.hookFunction('ChatRoomSyncMemberLeave', 0, (args, next) => {
    peers.delete(args[0].SourceMemberNumber);
    return next(args);
  });
  bcAeeModSdk.hookFunction('ChatRoomSyncMemberJoin', 0, (args, next) => {
    peers.delete(args[0].SourceMemberNumber);
    const result = next(args);
    // Let the entering client finish installing its room state first.
    setTimeout(requestStatus, 600);
    return result;
  });
  const tick = () => {
    if (!localActive() || !inRoom()) { peers.clear(); requests.clear(); }
    if (!localActive()) return;
    shareAeeSettings();
    requestStatus();
  };
  setInterval(tick, INTERVAL);
  settings.enableFreeDraw.onChange(() => {
    shareAeeSettings();
    send({type: 'changed'});
  });
  tick();
  return true;
}
