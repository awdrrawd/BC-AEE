// Lightweight "who else in this room runs AEE" detection — AEE's equivalent of
// ECHO's CharacterTag. A non-AEE client literally cannot serialize our custom
// assets, so when a full-appearance sync drops our items we need to know whether
// the sender is AEE (deliberate removal → leave it) or not (accidental strip →
// restore it). See tryHookAppearanceSync in ./index.ts.
//
// Mechanism: a hidden chat handshake. On entering a room we broadcast a hidden
// HELLO; anyone already here records us and replies with a hidden REPLY, so both
// sides end up knowing each other. Hidden messages are never shown to the user
// (BC drops Type:"Hidden" before display).

import bcAeeModSdk from '@/modsdk';
import {MASK_PEER_ANNOUNCE_DELAY_MS, MASK_PEER_ANNOUNCE_INTERVAL_MS} from './constants';

const HELLO = 'LikoAEE:hello';
const REPLY = 'LikoAEE:hello-reply';

// Member numbers confirmed to run AEE. Pruned to the current room on every sync
// so a number can't linger after that member leaves.
const aeeMembers = new Set<number>();

export function isAeeMember(memberNumber: number | null | undefined): boolean {
  return memberNumber != null && aeeMembers.has(memberNumber);
}

function playerNumber(): number | null {
  return typeof Player !== 'undefined' && typeof Player?.MemberNumber === 'number' ? Player.MemberNumber : null;
}

function sendHidden(content: string) {
  try {
    if (typeof ServerPlayerIsInChatRoom === 'function' && ServerPlayerIsInChatRoom()
      && typeof ServerSend === 'function') {
      ServerSend('ChatRoomChat', {Content: content, Type: 'Hidden', Dictionary: []});
    }
  } catch { /* offline / not in a room — ignore */ }
}

// Drop anyone no longer in the room (member numbers are account-unique, so a
// rejoin re-detects via a fresh HELLO — no risk of a stale hit).
function pruneToRoom() {
  if (!Array.isArray(ChatRoomCharacter)) return;
  const present = new Set<number>();
  for (const c of ChatRoomCharacter) {
    if (typeof c?.MemberNumber === 'number') present.add(c.MemberNumber);
  }
  for (const m of aeeMembers) if (!present.has(m)) aeeMembers.delete(m);
}

let installed = false;
let lastAnnounce = 0;

export function installPeerDetection(): boolean {
  if (installed) return true;
  if (typeof ChatRoomMessage !== 'function' || typeof ChatRoomSync !== 'function') return false;
  installed = true;

  // Listen for our hidden handshake. Record the sender; reply ONLY to a fresh
  // HELLO (never to a REPLY) so two clients can't ping-pong forever.
  bcAeeModSdk.hookFunction('ChatRoomMessage', 0, (args, next) => {
    try {
      const data = args[0] as {Sender?: number; Content?: string; Type?: string} | undefined;
      if (data && data.Type === 'Hidden' && typeof data.Sender === 'number'
        && (data.Content === HELLO || data.Content === REPLY)
        && data.Sender !== playerNumber()) {
        aeeMembers.add(data.Sender);
        if (data.Content === HELLO) sendHidden(REPLY);
      }
    } catch { /* never let handshake parsing break chat */ }
    return next(args);
  });

  // Announce on room entry (ChatRoomSync fires when we receive a room). Prune
  // leavers, then re-announce at most every few seconds during sync bursts.
  bcAeeModSdk.hookFunction('ChatRoomSync', 0, (args, next) => {
    const ret = next(args);
    try {
      pruneToRoom();
      const now = Date.now();
      if (now - lastAnnounce > MASK_PEER_ANNOUNCE_INTERVAL_MS) {
        lastAnnounce = now;
        setTimeout(() => sendHidden(HELLO), MASK_PEER_ANNOUNCE_DELAY_MS);
      }
    } catch { /* ignore */ }
    return ret;
  });

  // Loaded (or reloaded) while already inside a room → ChatRoomSync won't fire
  // again, so announce once now.
  lastAnnounce = Date.now();
  setTimeout(() => sendHidden(HELLO), MASK_PEER_ANNOUNCE_DELAY_MS);
  return true;
}
