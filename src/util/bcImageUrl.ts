// Custom-asset mods built on @sugarch/bc-asset-manager (ECHO among them) do not serve their images from BC's
// server. They register a "BC path -> CDN URL" mapping and rewrite the URL inside BC's own drawing functions
// (DrawImageEx, GLDrawImage, DrawGetImage, ...). A plain DOM <img> or CSS background never passes through those,
// so AEE applies the same mapping itself before showing an asset preview.
//
// The library keeps each mapping instance in a shared global under "ImageMapping@<library version>". Mods that
// bundle different versions each have their own instance with their own mappings, so every instance is asked.

const SHARED_GLOBALS = '__BC_LUZI_GLOBALS__';
const MAPPING_KEY = /^ImageMapping@/;
const NO_MAP_PREFIX = '@nomap/';

type ImageMapper = {mapImgSrc: (path: string) => unknown};

function imageMappers(): ImageMapper[] {
  const shared = (globalThis as Record<string, unknown>)[SHARED_GLOBALS];
  if (!shared || typeof shared !== 'object') return [];
  const mappers: ImageMapper[] = [];
  for (const [key, instance] of Object.entries(shared)) {
    if (!MAPPING_KEY.test(key)) continue;
    const storage = (instance as {storage?: Partial<ImageMapper>} | null | undefined)?.storage;
    if (storage && typeof storage.mapImgSrc === 'function') mappers.push(storage as ImageMapper);
  }
  return mappers;
}

/** The URL a custom asset's image is really served from; unchanged for BC's own images. */
export function resolveBcImageUrl(url: string): string {
  if (!url) return url;
  let resolved = url;
  for (const mapper of imageMappers()) {
    try {
      const mapped = mapper.mapImgSrc(resolved);
      if (typeof mapped === 'string' && mapped) resolved = mapped;
    } catch { /* a broken third-party mapper must not break the panel */ }
  }
  return resolved.startsWith(NO_MAP_PREFIX) ? resolved.slice(NO_MAP_PREFIX.length) : resolved;
}
