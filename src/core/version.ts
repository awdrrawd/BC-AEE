import packageJson from '../../package.json';

export const MOD_VERSION: string = packageJson.version;

window.Liko = window.Liko ?? {};
export const AEE_ALREADY_LOADED = !!window.Liko.AEE;
window.Liko.AEE = MOD_VERSION;
