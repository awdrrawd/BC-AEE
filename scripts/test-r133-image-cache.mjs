import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Runs src/core/bcImageCompat.ts against simulated BC globals for both the R132
// (Map caches) and the R133 (ImageCache / CachedImage) runtime.
const source = ts.transpileModule(
  fs.readFileSync(new URL('../src/core/bcImageCompat.ts', import.meta.url), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText;

function load(globals) {
  const exports = {};
  const context = vm.createContext({exports, Date, console, Symbol, Map, Array, Error, CommonTime: () => Date.now(), ...globals});
  vm.runInContext(source, context);
  return {mod: exports, context};
}
const img = (width, complete = true) => ({width, height: width, naturalWidth: complete ? width : 0, complete, src: 'x'});

// ---------------------------------------------------------------- R132
{
  const {mod} = load({
    GLDrawImageCache: new Map([['a.png', img(100)], ['loading.png', img(0, false)]]),
    DrawCacheImage: new Map([['b.png', img(50)]]),
  });
  assert.equal(mod.usesImageCache(), false, 'R132 is detected as legacy');
  assert.equal(mod.getLoadedImage('a.png').width, 100);
  assert.equal(mod.getLoadedImage('b.png').width, 50, 'falls back to DrawCacheImage');
  assert.equal(mod.getLoadedImage('loading.png'), null, 'unfinished <img> is not loaded');
  assert.equal(mod.getLoadedImage('missing.png'), null);
  assert.equal(mod.isImagePending('loading.png'), true);
  assert.equal(mod.isImagePending('a.png'), false);
  assert.equal(mod.isImagePending('missing.png'), false, 'removed entries are not pending');

  // Temporary preview canvases are released from both R132 caches.
  const deleted = [], texCache = new Map([['c1__a', {texture: 't1'}], ['other', {texture: 't2'}]]);
  const glCache = new Map([['c1__x', img(1)], ['keep', img(1)]]);
  const {mod: m2} = load({
    GLDrawImageCache: glCache, DrawCacheImage: new Map(),
    GLDrawCanvas: {GL: {textureCache: texCache, deleteTexture: t => deleted.push(t)}},
  });
  m2.releaseNamedTextures('c1__');
  assert.deepEqual(deleted, ['t1']);
  assert.deepEqual([...texCache.keys()], ['other']);
  assert.deepEqual([...glCache.keys()], ['keep']);
}

// ---------------------------------------------------------------- R133
class CachedImage {
  constructor(cache, url) { this.cache = cache; this.url = url; this.state = 'uncached'; this.data = null; this.lastUsed = 0; }
  async _load() { if (this.state === 'uncached') this.state = 'loading'; }
  unload() { this.data?.close(); this.data = null; this.state = 'uncached'; }
  isLoaded() { return this.state === 'loaded'; }
  isLoading() { return this.state === 'loading'; }
  isDoneLoading() { return this.state === 'loaded' || this.state === 'failed'; }
}
class ImageCache {
  constructor() { this.cache = new Map(); }
  has(url) { return !!this.cache.get(url); }
  get(url) {
    let image = this.cache.get(url);
    if (!image) { image = new CachedImage(this, url); this.cache.set(url, image); }
    image._load();
    return image;
  }
  delete(url) { const known = this.cache.get(url); if (!known) return; known.unload(); this.cache.delete(url); }
}
{
  const drawCache = new ImageCache();
  const {mod} = load({GLDrawDecodeImage: async () => {}, DrawImageCache: drawCache, GLDrawImageCache: new ImageCache()});
  assert.equal(mod.usesImageCache(), true, 'R133 is detected through GLDrawDecodeImage');

  assert.equal(mod.isImagePending('x.png'), false, 'unknown URL is not pending');
  assert.equal(mod.getLoadedImage('x.png'), null, 'first lookup only starts the load');
  assert.equal(mod.isImagePending('x.png'), true);
  const entry = drawCache.cache.get('x.png');
  entry.state = 'loaded'; entry.data = {width: 80, close() {}};
  assert.equal(mod.getLoadedImage('x.png').width, 80, 'ImageBitmap is returned once loaded');
  assert.equal(mod.isImagePending('x.png'), false);

  // Injecting a generated mask: BC reads DrawImageCache.get(url) → isLoaded()/data.
  const mask = img(256);
  mod.seedDrawImage('mask.png', mask);
  const seeded = drawCache.get('mask.png');
  assert.equal(seeded.isLoaded(), true);
  assert.equal(seeded.data, mask);
  assert.doesNotThrow(() => drawCache.delete('mask.png'), 'BC purge must not call bitmap.close() on an <img>');
  assert.equal(drawCache.has('mask.png'), false);

  // Not decoded yet → BC sees "not loaded" (empty mask for this frame), then flips once decoded.
  const late = img(0, false);
  mod.seedDrawImage('late.png', late);
  assert.equal(drawCache.get('late.png').isLoaded(), false);
  Object.assign(late, {complete: true, naturalWidth: 64, width: 64});
  mod.seedDrawImage('late.png', late);
  assert.equal(drawCache.get('late.png').isLoaded(), true);

  // Seeding over a real entry frees its bitmap first.
  const real = drawCache.get('real.png');
  let closed = false;
  real.state = 'loaded'; real.data = {close() { closed = true; }};
  mod.seedDrawImage('real.png', mask);
  assert.equal(closed, true);

  assert.doesNotThrow(() => mod.releaseNamedTextures('abc__'), 'no-op on R133 (no Map#keys)');
}

// Texture upload keeps R132's GLDrawBingImageToTextureInfo behaviour.
{
  const {mod} = load({});
  const calls = [];
  const gl = {TEXTURE_2D: 3553, RGBA: 6408, UNSIGNED_BYTE: 5121,
    bindTexture: (...a) => calls.push(['bind', ...a]), texImage2D: (...a) => calls.push(['tex', ...a])};
  const info = {width: 1, height: 1, texture: 'T'};
  mod.uploadImageToTexture(gl, img(64), info);
  assert.deepEqual([info.width, info.height], [64, 64]);
  assert.deepEqual(calls.map(c => c[0]), ['bind', 'tex']);
}

console.log('R133 image-cache compatibility (R132 Map caches + R133 ImageCache) passed.');
