// Supplies display text for our custom groups/assets/options so BC doesn't show
// "MISSING TEXT IN AssetStrings.csv". BC looks up AssetStrings keys of the form
// `${Group}${Asset}${Option}` (plus item names / select prompts); we map those to
// AEE's own i18n and resolve them LIVE via t(), so the labels follow the current
// UI language and update when it changes (the AssetTextGet hook runs each frame).

import {i18next, normalizeLanguage} from '@/i18n/i18n';
import bcAeeModSdk from '@/modsdk';
import {SG_MASK_GROUP, SG_ASSET, SG_OPTIONS, DRAW_GROUPS, DRAW_ASSET, type SGOption} from './constants';

declare const TranslationLanguage: string | undefined;

// These labels appear in BC's appearance menu next to BC's own groups, so they
// must follow the GAME language (BC's `TranslationLanguage`) — NOT AEE's own
// ui-language override (that would show Chinese in an English game). This is how
// BC (and ECHO) localize asset groups. Resolve the key in BC's language via
// i18next's per-call `lng`, independent of AEE's active UI language.
function bcLanguage(): string {
  return normalizeLanguage(typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : undefined);
}
export function maskLabel(key: string, vars?: Record<string, string | number>): string {
  return i18next.t(key, {lng: bcLanguage(), defaultValue: `missing translation: ${key}`, ...(vars ?? {})});
}

// i18n key for a single-glove option (side + scope). scope 'luzi' → 'echo' key.
export function gloveOptionKey(o: SGOption): string {
  const scope = o.scope === 'luzi' ? 'echo' : o.scope;
  return `mask-glove-${o.side.toLowerCase()}-${scope}`;
}

// exact key → resolver; resolvers call t() so the value tracks the live language.
const exact = new Map<string, () => string>();
// base-item prefixes → resolver (fallback for any un-mapped sub-key, e.g. "Select").
const bases: {prefix: string; resolve: () => string}[] = [];

let built = false;
function build() {
  if (built) return;
  built = true;

  const sgBase = `${SG_MASK_GROUP}${SG_ASSET}`;
  const gloveName = () => maskLabel('mask-single-glove-name');
  exact.set(sgBase, gloveName);
  bases.push({prefix: sgBase, resolve: gloveName});
  exact.set(`${sgBase}Select`, () => maskLabel('mask-single-glove-select'));
  SG_OPTIONS.forEach(o => exact.set(`${sgBase}${o.Name}`, () => maskLabel(gloveOptionKey(o))));

  DRAW_GROUPS.forEach((g, i) => {
    const base = `${g}${DRAW_ASSET}`;
    const name = () => maskLabel('mask-free-draw-name', {n: i + 1});
    exact.set(base, name);
    bases.push({prefix: base, resolve: name});
  });
}

// Resolve a label for a mask-system AssetStrings key, or null if not ours.
export function maskSystemText(key: string): string | null {
  if (!built) build();
  const hit = exact.get(key);
  if (hit != null) return hit();
  for (const b of bases) if (key.startsWith(b.prefix)) return b.resolve();
  return null;
}

let installed = false;
export function installMaskTranslations() {
  if (installed) return;
  build();
  const hook = (args: [string], next: (a: [string]) => string): string => {
    const label = typeof args[0] === 'string' ? maskSystemText(args[0]) : null;
    return label != null ? label : next(args);
  };
  if (typeof AssetTextGet === 'function') bcAeeModSdk.hookFunction('AssetTextGet', 1, hook as never);
  if (typeof DialogFindPlayer === 'function') bcAeeModSdk.hookFunction('DialogFindPlayer', 1, hook as never);
  installed = true;
}
