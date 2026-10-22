// The one switch for developer logging. Off by default and persisted per browser.
// Turn it on from the game's console with `Liko.AEE.debug(true)` and off with `Liko.AEE.debug(false)`;
// no reload is needed. Warnings and errors are never gated: they report real failures.
// This file is the only place allowed to call console.log/table (see eslint.config.js).
import {readText, removeKey, STORAGE_KEYS, writeText} from '@/core/storage';

let enabled = readText(STORAGE_KEYS.debug) === '1';

export function isDebugEnabled(): boolean {
  return enabled;
}

export function setDebug(next: boolean): boolean {
  enabled = Boolean(next);
  if (enabled) writeText(STORAGE_KEYS.debug, '1');
  else removeKey(STORAGE_KEYS.debug);
  console.info(`🐈‍⬛ [AEE] Debug logging ${enabled ? 'on' : 'off'}.`);
  return enabled;
}

/** Verbose trace, printed only while debug logging is on. */
export function debugLog(...args: unknown[]): void {
  if (enabled) console.log('[AEE]', ...args);
}

/** Output of a diagnostic the user asked for explicitly (for example `likoAeeDumpLayers()`); never gated. */
export function diagLog(...args: unknown[]): void {
  console.log('[AEE]', ...args);
}

export function diagTable(rows: unknown): void {
  console.table(rows);
}

export function installDebugApi(): void {
  Object.assign(window.Liko.AEE as Record<string, unknown>, {debug: setDebug});
}
