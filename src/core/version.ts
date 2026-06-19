import packageJson from '../../package.json';

export const MOD_VERSION: string = packageJson.version;

window.Liko = window.Liko ?? {};
window.Liko.AEE = MOD_VERSION;
