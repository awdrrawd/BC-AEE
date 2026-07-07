import packageJson from '../../package.json';

export const MOD_VERSION: string = packageJson.version;

window.Liko = window.Liko ?? {};
// Captured *before* we (re)assign below, so this reflects whether some
// earlier load of this same bundle already ran - regardless of whether it
// arrived via the loader, a directly-installed copy of this script, or both
// at once. This is the source of truth for duplicate-load detection; the
// loader only mirrors it for an early, pre-download warning.
export const AEE_ALREADY_LOADED = !!window.Liko.AEE;
window.Liko.AEE = MOD_VERSION;
