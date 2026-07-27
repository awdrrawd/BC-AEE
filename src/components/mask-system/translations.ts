// Supplies display text for our custom groups/assets/options so BC doesn't show
// "MISSING TEXT IN AssetStrings.csv". Our option Names are already the desired
// Chinese labels; here we resolve the AssetStrings.csv keys BC looks up
// (`${Group}${Asset}${Option}`, plus item names / select prompts).

import bcAeeModSdk from '@/modsdk';
import {SG_MASK_GROUP, SG_ASSET, SG_OPTIONS, DRAW_GROUPS, DRAW_ASSET} from './constants';

const exact = new Map<string, string>();
// base item prefixes → default name (fallback for any un-mapped sub-key, e.g. "Select")
const bases: {prefix: string; name: string}[] = [];

let built = false;
function build() {
  if (built) return;
  built = true;

  const sgBase = `${SG_MASK_GROUP}${SG_ASSET}`;
  exact.set(sgBase, '單手套');
  bases.push({prefix: sgBase, name: '單手套'});
  SG_OPTIONS.forEach(o => exact.set(`${sgBase}${o.Name}`, o.Name));
  exact.set(`${sgBase}Select`, '選擇單手套（左右＋範圍）');

  DRAW_GROUPS.forEach((g, i) => {
    const base = `${g}${DRAW_ASSET}`;
    exact.set(base, `自由繪圖${i + 1}`);
    bases.push({prefix: base, name: `自由繪圖${i + 1}`});
  });
}

// Resolve a label for a mask-system AssetStrings key, or null if not ours.
export function maskSystemText(key: string): string | null {
  if (!built) build();
  const hit = exact.get(key);
  if (hit != null) return hit;
  for (const b of bases) if (key.startsWith(b.prefix)) return b.name;
  return null;
}

let installed = false;
export function installMaskTranslations() {
  if (installed) return;
  build();
  const hook = (args: [string], next: (a: [string]) => string): string => {
    const t = typeof args[0] === 'string' ? maskSystemText(args[0]) : null;
    return t != null ? t : next(args);
  };
  if (typeof AssetTextGet === 'function') bcAeeModSdk.hookFunction('AssetTextGet', 1, hook as never);
  if (typeof DialogFindPlayer === 'function') bcAeeModSdk.hookFunction('DialogFindPlayer', 1, hook as never);
  installed = true;
}
