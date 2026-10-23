import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// resolveBcImageUrl asks every image-mapping instance that custom-asset mods (ECHO and others built on
// @sugarch/bc-asset-manager) keep in the shared __BC_LUZI_GLOBALS__ global, under "ImageMapping@<version>".
const code = ts.transpileModule(fs.readFileSync(new URL('../src/util/bcImageUrl.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
// The library's own mapping rules: only relative .png paths are looked up; mapped URLs are left alone.
const mapper = table => ({storage: {mapImgSrc: path => typeof path === 'string' && path.endsWith('.png') && !path.startsWith('http') ? table[path] ?? path : path}});

// Run in a context whose global object is the sandbox, as in the browser.
function load(shared) {
  const sandbox = vm.createContext({exports: {}});
  if (shared !== undefined) sandbox.__BC_LUZI_GLOBALS__ = shared;
  vm.runInContext(code, sandbox);
  return sandbox.exports.resolveBcImageUrl;
}

const echoPath = 'Assets/Female3DCG/ItemHood/汉堡_Luzi/Preview/汉堡_Luzi.png';
const cdn = 'https://cdn.jsdelivr.net/gh/example/repo@1.0.0/resources/Assets/Female3DCG/ItemHood/汉堡_Luzi.png';

assert.equal(load(undefined)('Assets/a.png'), 'Assets/a.png', 'no custom-asset mod loaded: unchanged');
assert.equal(load({})('Assets/a.png'), 'Assets/a.png');
assert.equal(load({Other: mapper({'Assets/a.png': 'https://x/a.png'})})('Assets/a.png'), 'Assets/a.png', 'only ImageMapping@ entries are used');
assert.equal(load('not an object')('Assets/a.png'), 'Assets/a.png');

let resolve = load({'ImageMapping@2.2.6': mapper({[echoPath]: cdn})});
assert.equal(resolve(echoPath), cdn, 'a custom asset image is mapped to its CDN URL');
assert.equal(resolve('Assets/Female3DCG/ItemHood/Plain.png'), 'Assets/Female3DCG/ItemHood/Plain.png', "BC's own images are untouched");
assert.equal(resolve(''), '');
assert.equal(resolve('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');

// Mods bundling different library versions each have their own instance and mappings.
resolve = load({'ImageMapping@2.2.6': mapper({'Assets/a.png': 'https://one/a.png'}), 'ImageMapping@3.0.0': mapper({'Assets/b.png': 'https://two/b.png'})});
assert.equal(resolve('Assets/a.png'), 'https://one/a.png');
assert.equal(resolve('Assets/b.png'), 'https://two/b.png');

// One broken mapper, or a nonsense return value, must not break the others.
resolve = load({
  'ImageMapping@1.0.0': {storage: {mapImgSrc() { throw new Error('boom'); }}},
  'ImageMapping@1.1.0': {storage: {mapImgSrc: () => 42}},
  'ImageMapping@1.2.0': {storage: {}},
  'ImageMapping@1.3.0': {},
  'ImageMapping@2.2.6': mapper({'Assets/a.png': 'https://ok/a.png'}),
});
assert.equal(resolve('Assets/a.png'), 'https://ok/a.png');

// "@nomap/" tells the library not to map; it strips the prefix when it draws, and so do we.
resolve = load({'ImageMapping@2.2.6': mapper({})});
assert.equal(resolve('@nomap/Assets/a.png'), 'Assets/a.png');
console.log('Image URL mapping checks passed: custom-asset CDN mapping, several instances, broken mappers and @nomap.');
