import {getCapturedLayerImages} from '@/controllers/appearancePickerController';

const cache = new Map<string, string | null>();
const MAX_CACHE_ENTRIES = 128;

export function getLayerThumbnail(index: number | 'all', max = 160): string | null {
  const captures = getCapturedLayerImages(index);
  if (!captures.length) return null;
  const key = `${index}:${max}:${captures.map(({url}) => url).join('|')}`;
  if (cache.has(key)) {
    const value = cache.get(key) ?? null;
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const {capture, bounds} of captures) {
    minX = Math.min(minX, capture.x + bounds.x);
    minY = Math.min(minY, capture.y + bounds.y);
    maxX = Math.max(maxX, capture.x + bounds.x + bounds.w);
    maxY = Math.max(maxY, capture.y + bounds.y + bounds.h);
  }
  const width = Math.max(1, maxX - minX), height = Math.max(1, maxY - minY);
  const scale = Math.min(max / width, max / height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#C4C4C4';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  captures.forEach(({capture, image}) => context.drawImage(image, capture.x - minX, capture.y - minY));
  let result: string | null = null;
  try { result = canvas.toDataURL('image/png'); } catch { /* a tainted source cannot be exported */ }
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  if (result) cache.set(key, result);
  return result;
}

export function clearLayerThumbnailCache() {
  cache.clear();
}
