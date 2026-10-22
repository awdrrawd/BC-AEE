import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {collectHookedFunctions, compare, crc32, fingerprint, hashSource, loadBcFunctions} from './check-bc-compat.mjs';

const temporaryRoot = path.resolve(os.tmpdir());
const workspace = fs.mkdtempSync(path.join(temporaryRoot, 'aee-bc-hooks-'));
const write = (file, text) => {
  const target = path.join(workspace, file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, text);
};
try {
  // The CRC must match the standard CRC-32 check value and, more importantly, ModSDK's own originalHash.
  assert.equal(crc32('123456789'), 'CBF43926');
  const sdkText = fs.readFileSync(new URL('../src/modsdk.js', import.meta.url), 'utf8').match(/^var bcModSdk=.*\}\(\);$/m)?.[0];
  assert.ok(sdkText, 'bundled ModSDK source is found');
  const sandbox = vm.createContext({TextEncoder, console, alert() {}});
  vm.runInContext(`var window = globalThis; ${sdkText}`, sandbox);
  vm.runInContext('function SampleLf(a) {\r\n  return a + "é";\r\n}\nfunction SampleCrlf(b) { return b; }', sandbox);
  // Read the sources first: ModSDK swaps the global for its router as soon as it is asked about a function.
  const originals = Object.fromEntries(['SampleLf', 'SampleCrlf'].map(name => [name, vm.runInContext(`${name}.toString()`, sandbox)]));
  const api = vm.runInContext('bcModSdk.registerMod({name: "hash-test", fullName: "hash-test", version: "1"})', sandbox);
  for (const [name, source] of Object.entries(originals)) {
    assert.equal(api.getOriginalHash(name), hashSource(source), `${name} hash matches ModSDK`);
  }

  // Hook discovery ignores declarations, flags names built at runtime and reports where each hook lives.
  write('src/a.ts', "bcAeeModSdk.hookFunction('Alpha' as never, 1, hook);\nbcAeeModSdk.callOriginal(\"Beta\", args);\n");
  write('src/nested/b.tsx', "bcAeeModSdk.hookFunction(`Alpha`, 2, hook);\nconst n = 'X'; bcAeeModSdk.hookFunction(n, 1, hook);\n");
  write('src/declare/types.d.ts', "hookFunction(functionName: string): void;\nhookFunction('Ignored');\n");
  write('src/modsdk.js', "hookFunction('AlsoIgnored', 1, f);\n");
  const hooked = collectHookedFunctions(path.join(workspace, 'src'), workspace);
  assert.deepEqual([...hooked.names.keys()].sort(), ['Alpha', 'Beta']);
  assert.deepEqual(hooked.names.get('Alpha').locations, ['src/a.ts:1', 'src/nested/b.tsx:1']);
  assert.deepEqual(hooked.dynamic, ['src/nested/b.tsx:2']);

  // Only top-level functions that can be hooked on window are indexed.
  const alphaSource = 'function Alpha(a) {\n  return a + 1;\n}';
  write('bc/Scripts/Game.js', 'var GameVersion = "R999";\n');
  write('bc/Scripts/A.js', `${alphaSource}\nasync function Beta() { return 2; }\nvar Gamma = function () { return 3; };\nvar Delta = (x) => x;\nconst Hidden = () => 0;\nfunction Outer() { function Inner() {} }\n`);
  write('bc/Screens/Room/B.js', 'function Epsilon() {}\n');
  write('bc/Screens/Room/Broken.js', 'function (((\n');
  const bc = loadBcFunctions(path.join(workspace, 'bc'));
  assert.equal(bc.gameVersion, 'R999');
  assert.deepEqual([...bc.functions.keys()].sort(), ['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma', 'Outer']);
  assert.equal(bc.functions.get('Alpha').hash, hashSource(alphaSource));
  assert.equal(bc.functions.get('Alpha').file, 'Scripts/A.js');
  assert.equal(bc.functions.get('Epsilon').file, 'Screens/Room/B.js');
  assert.equal(bc.parseErrors.length, 1);
  assert.match(bc.parseErrors[0], /Broken\.js/);
  write('upstream/BondageClub/Scripts/Game.js', 'var GameVersion = "R1";\n');
  write('upstream/BondageClub/Scripts/A.js', alphaSource);
  assert.equal(loadBcFunctions(path.join(workspace, 'upstream')).functions.get('Alpha').hash, hashSource(alphaSource), 'upstream layout is supported');

  // Namespaced targets and names BC generates at runtime from a `<Name>Hook` function.
  write('bc2/Scripts/Game.js', 'var GameVersion = "R998";\n');
  write('bc2/Scripts/Ns.js', 'class Panel { static create() { return 1; } build() { return 2; } }\nvar Util = { run: function () { return 3; }, quick() { return 4; }, value: 5 };\nfunction ExtendedHook() { return 6; }\n');
  const ns = loadBcFunctions(path.join(workspace, 'bc2'));
  assert.deepEqual([...ns.functions.keys()].sort(), ['ExtendedHook', 'Panel.build', 'Panel.create', 'Util.quick', 'Util.run']);
  const nsHooked = {names: new Map(['Panel.create', 'Util.run', 'Extended', 'Util.value', 'Nope'].map(name => [name, {locations: []}]))};
  const nsPrint = fingerprint(nsHooked, ns);
  assert.deepEqual(Object.keys(nsPrint.functions).sort(), ['Extended', 'Panel.create', 'Util.run']);
  assert.equal(nsPrint.functions.Extended.via, 'Hook');
  assert.deepEqual(nsPrint.missing.sort(), ['Nope', 'Util.value'], 'non-function members and unknown names are reported');

  // Drift classification.
  const current = fingerprint(hooked, bc);
  assert.deepEqual(Object.keys(current.functions), ['Alpha', 'Beta']);
  assert.deepEqual(current.missing, []);
  assert.equal(compare({functions: current.functions}, current).drift, false);
  const drifted = compare({functions: {Alpha: {hash: '00000000'}, Beta: current.functions.Beta, Old: {hash: '11111111'}}}, {
    functions: {...current.functions, New: {hash: '22222222', file: 'x'}}, missing: ['Gone'],
  });
  assert.deepEqual(drifted.changed.map(item => item.name), ['Alpha']);
  assert.deepEqual([drifted.added, drifted.stale, drifted.missing], [['New'], ['Old'], ['Gone']]);
  assert.equal(drifted.drift, true);

  // The CLI against the real source tree: a fixture BC that defines every hooked function.
  const real = collectHookedFunctions(fileURLToPath(new URL('../src', import.meta.url)), fileURLToPath(new URL('../', import.meta.url)));
  assert.ok(real.names.size > 30, 'the real project hooks BC functions');
  const functionText = name => `function ${name}() { return '${name}'; }\n`;
  write('fixture/Scripts/Game.js', 'var GameVersion = "R-test";\n');
  write('fixture/Scripts/All.js', [...real.names.keys()].map(functionText).join(''));
  const run = (...args) => {
    const env = {...process.env};
    delete env.BC_DIR;
    return spawnSync(process.execPath, [fileURLToPath(new URL('./check-bc-compat.mjs', import.meta.url)), ...args], {encoding: 'utf8', env});
  };
  const baseline = path.join(workspace, 'baseline.json');
  const fixtureDir = path.join(workspace, 'fixture');
  assert.equal(run('--nonsense').status, 2, 'unknown arguments are rejected');
  assert.equal(run('--bc-dir', fixtureDir, '--baseline', baseline).status, 2, 'a missing baseline is a usage error');
  assert.equal(run('--bc-dir', fixtureDir, '--baseline', baseline, '--update').status, 0);
  assert.equal(JSON.parse(fs.readFileSync(baseline, 'utf8')).gameVersion, 'R-test');
  assert.equal(run('--bc-dir', fixtureDir, '--baseline', baseline).status, 0, 'unchanged source is in sync');
  const [victim] = [...real.names.keys()];
  write('fixture/Scripts/All.js', [...real.names.keys()].map(name => name === victim ? `function ${name}() { return 'changed'; }\n` : functionText(name)).join(''));
  const report = path.join(workspace, 'report.md');
  const changed = run('--bc-dir', fixtureDir, '--baseline', baseline, '--report', report);
  assert.equal(changed.status, 1, 'a changed hooked function is reported as drift');
  assert.match(fs.readFileSync(report, 'utf8'), new RegExp(`- ${victim} \\(Scripts/All\\.js\\)`));
  write('fixture/Scripts/All.js', [...real.names.keys()].filter(name => name !== victim).map(functionText).join(''));
  assert.equal(run('--bc-dir', fixtureDir, '--baseline', baseline).status, 1, 'a removed BC function is reported as drift');
  console.log('BC hook checks passed: ModSDK-compatible CRC, hook discovery, top-level function index, drift classification and CLI exit codes.');
} finally {
  assert.equal(path.dirname(path.resolve(workspace)), temporaryRoot);
  assert.ok(path.basename(workspace).startsWith('aee-bc-hooks-'));
  fs.rmSync(workspace, {recursive: true, force: true});
}
