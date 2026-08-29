import packageJson from '../../package.json';

export const MOD_VERSION: string = packageJson.version;

window.Liko = window.Liko ?? {};
Object.assign(window.Liko.AEE, {version: MOD_VERSION});
