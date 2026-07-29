// Supplies display text for our custom groups/assets/options so BC doesn't show
// "MISSING TEXT IN AssetStrings.csv". BC looks up AssetStrings keys of the form
// `${Group}${Asset}${Option}` (plus item names / select prompts); we map those to
// AEE's own i18n and resolve them LIVE via t(), so the labels follow the current
// UI language and update when it changes (the AssetTextGet hook runs each frame).

import {t} from '@/i18n/i18n';
import bcAeeModSdk from '@/modsdk';
import {SG_MASK_GROUP, SG_ASSET, SG_OPTIONS, DRAW_GROUPS, DRAW_ASSET, type SGOption} from './constants';

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
  const gloveName = () => t('mask-single-glove-name');
  exact.set(sgBase, gloveName);
  bases.push({prefix: sgBase, resolve: gloveName});
  exact.set(`${sgBase}Select`, () => t('mask-single-glove-select'));
  SG_OPTIONS.forEach(o => exact.set(`${sgBase}${o.Name}`, () => t(gloveOptionKey(o))));

  DRAW_GROUPS.forEach((g, i) => {
    const base = `${g}${DRAW_ASSET}`;
    const name = () => t('mask-free-draw-name', {n: i + 1});
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
