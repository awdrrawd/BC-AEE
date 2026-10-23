import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Property.CustomDraw arrives from other players and imported outfits. drawImageSource must let only png/webp
// data URLs (raw, or LZString-compressed) through, so no free-draw value can ever become a network <img src>.
const compile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;

const lru = {exports: {}};
vm.runInContext(compile('../src/components/mask-system/lruCache.ts'), vm.createContext({exports: lru.exports}));

// Stand-in for BC's LZString: reversible, returns null on garbage like the real decompressFromBase64.
const LZString = {
  compressToBase64: text => Buffer.from(text, 'utf8').toString('base64'),
  decompressFromBase64: text => {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
    return Buffer.from(text, 'base64').toString('utf8') || null;
  },
};
const sandbox = vm.createContext({exports: {}, require: () => lru.exports, LZString});
vm.runInContext(compile('../src/components/mask-system/freeDraw/drawSource.ts'), sandbox);
const {drawImageSource, MAX_DRAW_SOURCE_CHARS} = sandbox.exports;

const png = 'data:image/png;base64,iVBORw0KGgo=';
const webp = 'data:image/webp;base64,UklGRg==';

// Legitimate shapes.
assert.equal(drawImageSource(png), png, 'raw png data URL (SPS cache entry)');
assert.equal(drawImageSource(webp), webp, 'raw webp data URL (SPS cache entry)');
assert.equal(drawImageSource(LZString.compressToBase64(png)), png, 'embedded drawing is decompressed');
assert.equal(drawImageSource(LZString.compressToBase64(webp)), webp);

// Remote URLs must never pass, raw or hidden inside a compressed payload.
for (const url of [
  'https://attacker.example/pixel.png',
  'http://attacker.example/x',
  '//attacker.example/x.png',
  'blob:https://www.bondageprojects.com/00000000-0000-0000-0000-000000000000',
  'javascript:alert(1)',
]) {
  assert.equal(drawImageSource(url), null, `raw ${url}`);
  assert.equal(drawImageSource(LZString.compressToBase64(url)), null, `compressed ${url}`);
}

// Other data types are refused too.
for (const url of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:text/html;base64,PGgxPg==', 'data:image/gif;base64,R0lGOD==']) {
  assert.equal(drawImageSource(url), null, `raw ${url}`);
  assert.equal(drawImageSource(LZString.compressToBase64(url)), null, `compressed ${url}`);
}

// Non-strings, empty and garbage values.
for (const value of [undefined, null, 0, {}, [], '', 'not base64 !!!', '@@@@']) assert.equal(drawImageSource(value), null);

// Oversized input is refused without decompressing.
assert.equal(drawImageSource('data:image/png;base64,' + 'A'.repeat(MAX_DRAW_SOURCE_CHARS)), null, 'oversized raw');
assert.equal(drawImageSource('A'.repeat(MAX_DRAW_SOURCE_CHARS + 1)), null, 'oversized compressed');

// A throwing decompressor (malformed payload) is treated as invalid, not propagated.
const throwing = vm.createContext({exports: {}, require: () => lru.exports, LZString: {decompressFromBase64() { throw new Error('boom'); }}});
vm.runInContext(compile('../src/components/mask-system/freeDraw/drawSource.ts'), throwing);
assert.equal(throwing.exports.drawImageSource('AAAA'), null);

// Without LZString (not yet loaded) only raw data URLs work.
const bare = vm.createContext({exports: {}, require: () => lru.exports});
vm.runInContext(compile('../src/components/mask-system/freeDraw/drawSource.ts'), bare);
assert.equal(bare.exports.drawImageSource(png), png);
assert.equal(bare.exports.drawImageSource('AAAA'), null);

console.log('free-draw source validation passed');
